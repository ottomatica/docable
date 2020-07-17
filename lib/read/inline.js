const marked = require('marked');
const fs = require('fs');
const hljs = require('highlight.js');
  
class InlineReader
{
    async parse(file)
    {
        let highlight = (code, language) => {
          const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
          return hljs.highlight(validLanguage, code).value;
        };

        let renderer = 
        {
          code(code, infostring, escaped, options)
          {
            options= options || this.options;
            if( infostring.indexOf("|") >= 0 )
            {
              let data = infostring.split('|');
              let lang = data[0];
              let attributes = data[1].split(',').map( a => a.split('=') );
              console.log(attributes)
              let type = attributes.filter( a => a[0] === 'type')[0][1].replace(/['"]+/g, '');
              let data_attributes = attributes
                  .map( key_value => `data-${key_value[0]}=${key_value[1]}` );
              
              return `
              <pre class="docable-cell docable-cell-${type}" ${data_attributes}><code>
                  ${code}
              </code></pre>
              `;
            }
            else {
              console.log(infostring);
              return `
              <pre class="hljs language-${infostring}"><code>
              ${highlight(code)}
              </code></pre>
              `;
              // return marked.Renderer.prototype.code.apply(marked, [ code, infostring, escaped, options ]);
            }
          }
        };

        marked.use({ renderer });
    
        // Set options
        marked.setOptions({

        
            pedantic: false,
            gfm: true,
            tables: true,
            breaks: false,
            sanitize: false,
            smartLists: true,
            smartypants: true,
            xhtml: false
        });

        return await marked.parse(fs.readFileSync(file).toString());
    }

}

module.exports = InlineReader;

// Test inline reader...

( async () => {

  if( process.argv )
{

  let args = process.argv.slice(2);
  let reader = new InlineReader();
  let html = await reader.parse( args[0] );

  console.log( html );

}

})()

