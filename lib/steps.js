const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');

const Infra     = require('./infrastructure');


class Steps {
 
    constructor() 
    {
    }

    async read(stepFile)
    {
        let document = await yaml.safeLoad(fs.readFileSync(stepFile));
        return {docs: await this.documents(document), conn: await this.setup(document, stepFile)};
    }

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        // Headless infrastructure (slim)
        let conn = Infra.select( doc, provider, path.dirname(stepFile))
        return conn;
    }

    async documents(doc)
    {
        let docs = [];
        for ( let topLevelProperty of Object.keys(doc))
        {
            if( topLevelProperty.endsWith(".md") )
            {
                let docSteps = await this.documentSteps( doc[topLevelProperty] );
                docs.push( {file: topLevelProperty, steps: docSteps} );
            }
        }
        return docs;
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

                        steps.push( ($,sl) => this._setResults(sl.selectAsFile(sl.asContainsNext($, searchText), file ), sl, $, searchText));
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => this._setResults(sl.selectAndServe(sl.asContainsNext($, searchText)), sl, $, searchText) );
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => this._setResults(sl.selectAndExpect(sl.asContainsNext($, searchText)), sl, $, searchText) );
                        break;
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

    async _setResults(select, sl, $, searchText)
    {
        let response = await select;
        if(response.status)
            this._setPassing(sl, $, searchText);
        else
            this._setFailing(sl, $, searchText, response.error);
        return select;
    }

    _setPassing(sl, $, searchText) 
    {
        const content = sl.asContainsNext($, searchText);
        sl.asContainsNextElement($, searchText).text('✓ ' + content);
        sl.asContainsNextElement($, searchText).css('background-color', '#BDFCC9');
    }

    _setFailing(sl, $, searchText, error)
    {
        const content = sl.asContainsNext($, searchText);
        sl.asContainsNextElement($, searchText).text('𐄂 ' + content + "\n\n" + error);
        sl.asContainsNextElement($, searchText).css('background-color', 'LightCoral');
    }
}


module.exports = Steps;