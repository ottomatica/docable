const fs = require('fs');
const marked = require('marked');
const JSON5 = require('json5')
const hljs = require('highlight.js');
  
class InlineTransformer {
    static async transform(mdFile)
    {
        let highlight = (code, language) => {
          const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
          return hljs.highlight(validLanguage, code).value;
        };

        let renderer = 
        {
          code(code, _infostring, escaped, options) {

            let infostring = _infostring || '';
            let [lang, dataAttributes] = infostring.split(/\|(.*)/).map(d => d.trim());

            const hljsClasses = Boolean(lang) ? `hljs language-${lang}` : '';

            let dataAttributesStr="";
            if(dataAttributes) {
              // parsing dataAttributes
              dataAttributes = JSON5.parse(dataAttributes);
  
              dataAttributesStr = 'data-docable="true"';
              for(const data of Object.keys(dataAttributes)) {
                let val = dataAttributes[data];
                if( typeof val == "object")
                {
                  val = JSON.stringify(val).replace(/'/g, "\\'");
                }
                dataAttributesStr += ` data-${data}='${val}'`;
              }

            }


            return `<pre class="${hljsClasses}" ${dataAttributesStr}><code>` +
                      (Boolean(lang) ? highlight(code, lang) : code) +
                    `</code></pre>`;
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

        if (Buffer.isBuffer(mdFile)) {
          mdFile = mdFile.toString();
        }
        else {
          mdFile = await fs.promises.readFile(mdFile, { encoding: 'utf-8' });
        }

        return marked.parse(mdFile);
    }
}

module.exports = InlineTransformer;

// var buffer = Buffer.from(`
// This is a tree, it has file names.
// \`\`\`bash|{type:'command', path: 'git', block: {top:35, left:55, width:40, height: 98, title: 'A tree can contain blobs and other trees'}}
// git cat-file -p 5fa02bff4e
// \`\`\`
// `, "utf-8");

// let result = InlineTransformer.transform(buffer);
// console.log( result );