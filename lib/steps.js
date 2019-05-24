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

                        steps.push( ($,sl) => sl.selectAsFile($,searchText, file ));                    
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => sl.selectAndServe($,searchText) );                    
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => sl.selectAndExpect($, searchText ) );
                        break;
                    }
                    default:
                        throw new Error(`Unknown step: ${step}`);
                }
            }
        }

        return steps;
    }

}


module.exports = Steps;