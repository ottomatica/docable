const yaml = require('js-yaml');
const fs   = require('fs');

class Steps {
 
    constructor() 
    {
    }

    async read(stepFile)
    {
        let document = await yaml.safeLoad(fs.readFileSync(stepFile));

        let steps = [];

        for( let step of document.steps )
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

                        steps.push( ($,sl) => sl.selectAsFile(sl.asContainsNext($,searchText), file ));                    
                        break;
                    }
                    case "selectAndServe":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => sl.selectAndServe(sl.asContainsNext($,searchText)) );                    
                        break;
                    }
                    case "selectAndExpect":
                    {
                        let searchText = step[key];
                        steps.push( ($,sl) => sl.selectAndExpect(sl.asContainsNext($,searchText)) );
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