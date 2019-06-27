const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const git  = require('simple-git');

const Infra     = require('./infrastructure');
const Parse     = require('./parse');


class Steps {
 
    constructor(renderer, selector, css) 
    {
        this.renderer = renderer;
        this.css = css;
        if (selector) this.codeBlockSelector = selector;
    }

    async read(stepFile)
    {
        let document = await yaml.safeLoad(fs.readFileSync(stepFile));
        let {conn,cwd} = await this.setup(document, stepFile);
        
        let docPath;
        if( Object.keys(document.setup).includes('git') )
        {
            console.log(`Cloning or pulling: ${document.setup.git}`);
            docPath = await this.cloneOrPull( document.setup.git, path.dirname(stepFile) );
        } else {
            docPath = path.dirname(stepFile);
        }

        return {docs: await this.documents(document, docPath), conn: conn, cwd: cwd};
    }

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        let cwd = provider === 'local' ? path.join(process.cwd(), path.dirname(stepFile), 'docable_results') : '.';
        let conn = await Infra.select( doc, provider, path.dirname(stepFile))
        return {conn:conn,cwd:cwd};
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
        let parser   = new Parse(this.css);

        for ( let topLevelProperty of Object.keys(doc))
        {
            if( topLevelProperty.endsWith(".md") )
            {
                console.log(cwd, topLevelProperty)
                let md = path.join(cwd, topLevelProperty);
                let {engine, metadata} = await parser.markdown2HTML(md, this.renderer, cwd);

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
            let user = metadata[code].user;
            let persistent = metadata[code].persistent;

            console.log( metadata[code] );
            console.log( code );

            if( file )
            {
               steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAsFile( code, file, user, persistent )));
            }
            else if( serve )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndServe( code, user, persistent )));
            }
            else if( expect )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndExpect( code, user, persistent )));
            }
            else if( run )
            {
                steps.push( async ($,sl) => this._setResults(this.codeBlockSelector($, metadata[code].codeIndex), await sl.selectAndRun( code, user, persistent )) );
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
                let user = step[Object.keys(step)[1]];
                let persistent = step[Object.keys(step)[2]];

                console.log('\n\n\n\n===> persistent', persistent)

                switch( key )
                {
                    case "selectAsFile":
                    {
                        let searchText = step[key].split("=>")[0];
                        let file = step[key].split("=>")[1];

                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAsFile( sl.asContainsNext($, searchText), file, user )));
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndServe( sl.asContainsNext($, searchText), user )));
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndExpect( sl.asContainsNext($, searchText), user )) );
                        break;
                    }
                    case "selectAndRun":
                    {
                        if( step[key].expectblock && step[key].select )
                        {
                            let searchText = step[key].select;
                            steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText).add(sl.asContainsNextElement($, step[key].expectblock)), await sl.selectAndExpect( sl.asContainsNext($, searchText), sl.asContainsNext($, step[key].expectblock), user )) );
                            break;
                        }
                        else
                        {
                            let searchText = step[key];
                            steps.push( async ($,sl) => this._setResults(() => sl.asContainsNextElement($, searchText), await sl.selectAndRun( sl.asContainsNext($, searchText), user )) );
                            break;
                        }
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

    codeBlockSelector($, N) {
        return () => $(`pre:nth-of-type(${N})`);
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
        selector().addClass('passing');
    }

    async _setFailing(selector, error)
    {
        selector().prepend('<span>𐄂 </span>');
        selector().append(`<br/><br/>`);
        selector().append(`<span>️❕error: ${error}</span>`);
        selector().addClass('failing');
    }
}

module.exports = Steps;
