const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const cheerio = require('cheerio');

class StepFileReader
{
    async parse(doc, targetHtml)
    {
      const $ = cheerio.load( fs.readFileSync(targetHtml).toString() );
      for( let step of doc.steps )
      {
        let select = step.select;
        let elem = this.asContainsNext( $, select);

        console.log( `Found ${elem.text()}` );
        // Warning cannot use `.data()` to set data attributes:
        // https://github.com/cheeriojs/cheerio/issues/950
        elem.children('code').attr("data-docable", "true");

        // Set remaining data attributes based on step properties
        for( let key of Object.keys(step).filter( key => key != "select") )
        {
          elem.children('code').attr(`data-${key}`, step[key]);
        }
      }
      return $.html();
    }

    asContainsNext($, searchText)
    {
        // if (this.selector)
        //     return $(`*:contains("${searchText.trim()}")`).nextAll(this.selector).first().text();
        // else
        return $(`p:contains("${searchText.trim()}")`).nextAll('pre').first();
    }

}

module.exports = StepFileReader;

// Test stepfile reader...

( async () => {

if( process.argv )
{

  let args = process.argv.slice(2);
  let reader = new StepFileReader();

  let document = await yaml.safeLoad(fs.readFileSync(args[0]));
      
  for ( let topLevelProperty of Object.keys(document))
  {
    if(topLevelProperty.endsWith('.html')) 
    {
      let cwd = path.dirname( args[0] );
      let htmlFilePath = path.join(cwd, topLevelProperty);
      console.log(`Running ${htmlFilePath}`);

      let html = await reader.parse( document[topLevelProperty], htmlFilePath );
      console.log( html );
    }
  }
}

})()

