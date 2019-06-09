const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const git  = require('simple-git');

const Infra     = require('./infrastructure');
const Parse     = require('./parse');


class Steps {
 
    constructor(renderer) 
    {
        this.renderer = renderer;
    }

    async read(stepFile)
    {
        let document = await yaml.safeLoad(fs.readFileSync(stepFile));
        let provider = Object.keys(document.setup)[0];
        let conn = await this.setup(document, stepFile);
        return {docs: await this.documents(document, path.dirname(stepFile)), conn: conn, provider};
    }

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        // console.log( `Keys: ${Object.keys(doc.setup)}`);
        if( Object.keys(doc.setup).includes('git',0) )
        {
            console.log(`Cloning or pulling: ${doc.setup.git}`);
            await this.cloneOrPull( doc.setup.git, path.dirname(stepFile) );
        }        
        let conn = Infra.select( doc, provider, path.dirname(stepFile))
        return conn;
    }

    async cloneOrPull(repoURL, dest) {
        let name = path.basename(repoURL);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let repo_dir = path.join(dest, name);

        return new Promise((resolve, reject) => {

            // Run git pull if repo already exists locally
            if( fs.existsSync(repo_dir) )
            {
                git(repo_dir).pull( (err, data) =>
                {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                })
            }
            else // clone
            {
               git(dest).silent(true).clone(repoURL, (err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                });
            }
        });
    }

    async documents(doc, cwd)
    {
        let docs = [];
        let parser   = new Parse();

        for ( let topLevelProperty of Object.keys(doc))
        {
            if( topLevelProperty.endsWith(".md") )
            {
                console.log(cwd, topLevelProperty)
                let md = path.join(cwd, topLevelProperty);
                let {engine, metadata} = await parser.markdown2HTML(md, this.renderer);

                if( doc[topLevelProperty].steps )
                {
                    let docSteps = [];
                    if( doc[topLevelProperty].steps == "inline" )
                    {
                        // Use metadata to construct steps.
                        docSteps = await this.annotationSteps(metadata);
                    }
                    else
                    {
                        docSteps = await this.documentSteps( doc[topLevelProperty] );
                    }
                    docs.push( {file: topLevelProperty, steps: docSteps, engine: engine} );
                }
            }
        }
        return docs;
    }

    async annotationSteps(metadata)
    {
        let steps = [];
        for( let code of Object.keys(metadata) )
        {
            let file = metadata[code].content;
            let expect = metadata[code].expect;
            let serve  = metadata[code].serve;
            let run  = metadata[code].run;

            console.log( metadata[code] );
            console.log( code );

            if( file )
            {
               steps.push( async ($,sl) => this._setResults(() => $(`pre:nth-of-type(${metadata[code].codeIndex})`), await sl.selectAsFile( code, file )));
            }
            else if( serve )
            {
                steps.push( async ($,sl) => this._setResults(() => $(`pre:nth-of-type(${metadata[code].codeIndex})`), await sl.selectAndServe( code )));
            }
            else if( expect )
            {
                steps.push( async ($,sl) => this._setResults(() => $(`pre:nth-of-type(${metadata[code].codeIndex})`), await sl.selectAndExpect( code )));
            }
            else if( run )
            {
                steps.push( async ($,sl) => this._setResults(() => $(`pre:nth-of-type(${metadata[code].codeIndex})`), await sl.selectAndRun( code )) );
            }
        }
        return steps;
    }

    async documentSteps(doc)
    {
        let steps = [];

        for( let step of doc.steps )
        {
            if( step instanceof Object )
            {
                let key = Object.keys(step)[0];
                switch( key )
                {
                    case "selectAsFile":
                    {
                        let searchText = step[key].split("=>")[0];
                        let file = step[key].split("=>")[1];

                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAsFile( sl.asContainsNext($, searchText), file )));
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndServe( sl.asContainsNext($, searchText) )));
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndExpect( sl.asContainsNext($, searchText))) );
                        break;
                    }
                    case "selectAndRun":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndRun( sl.asContainsNext($, searchText))) );
                        break;
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

    async _setResults(selector, results)
    {
        let response = results;
        if( !response) return;
        if(response.status)
            await this._setPassing(selector);
        else
            await this._setFailing(selector, response.error );
        return results;
    }

    async _setPassing(selector) 
    {
        selector().prepend('<span>✓ </span>');
        selector().css('background-color', '#BDFCC9');
    }

    async _setFailing(selector, error)
    {
        selector().prepend('<span>𐄂 </span>');
        selector().css('background-color', 'LightCoral');
    }
}

module.exports = Steps;
