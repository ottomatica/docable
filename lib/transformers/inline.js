const fs = require('fs');
const marked = require('marked');
const JSON5 = require('json5')
const hljs = require('highlight.js');
const cheerio = require('cheerio');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');

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

            const hljsClasses = Boolean(lang) ? `hljs language-${lang}` : undefined;

            let isQuiz = false;
            let isPlayground = false;
            let dataAttributesStr="";
            if(dataAttributes) {
              // parsing dataAttributes
              dataAttributes = JSON5.parse(dataAttributes);
              isQuiz = dataAttributes.type === 'quiz';
              isPlayground = dataAttributes.type === 'playground';
  
              dataAttributesStr = `data-docable="true" data-lang="${lang}"`;
              for(const data of Object.keys(dataAttributes)) {
                let val = dataAttributes[data];
                if( typeof val == "object")
                {
                  val = JSON.stringify(val)
                }
                if( typeof val == "string" )
                {
                  // Escape inner single quotes with html escaped character.
                  val = val.replace(/'/g, "&#39;");
                }
                dataAttributesStr += ` data-${data}='${val}'`;
              }

            }

            if(isQuiz) {
                const $ = cheerio.load(marked.parse(code));
                const radiuBtnGroupName = uuidv4();

                $('input').each(function(index, element) {

                    if (dataAttributes.quiz_type === 'multichoice') {
                        $(element)
                            .attr('value', element.nextSibling.nodeValue.trim())
                            .attr('name', element.nextSibling.nodeValue.trim().replace(' ', '-'))
                            .removeAttr( 'disabled' );
                    }

                    else if (dataAttributes.quiz_type === 'singlechoice') {
                        $(element)
                            .attr('value', element.nextSibling.nodeValue.trim())
                            .attr('name', radiuBtnGroupName)
                            .removeAttr( 'disabled' )
                            .removeAttr('type')
                            .attr('type', 'radio');
                    }
                });

                // console.log($.html())

                return `<form ${dataAttributesStr}>
                            ${$.html()}
                        </form>`
            }
            else {
                if (isPlayground) code = _.escape(code);
                return `<pre` + 
                          (hljsClasses ? ` class="${hljsClasses}"` : '') +
                          ` ${dataAttributesStr}><code>` +
                          (Boolean(lang) ? highlight(code, lang) : code) +
                        `</code></pre>`;
            }
          },
          paragraph(text) {
            let footnotes = interpolateFootnotes(text);
            let references = interpolateReferences(text);
            if (text.match(footnoteMatch)) {
              return '<p class="footnote">' + footnotes + '</p>\n';
            }
            return marked.Renderer.prototype.paragraph.apply(null, [references]);
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

const footnoteMatch = /^\[\^([^\]]+)\]:([\s\S]*)$/;
const referenceMatch = /\[\^([^\]]+)\](?!\()/g;
const referencePrefix = "marked-fnref";
const footnotePrefix = "marked-fn";
const footnoteTemplate = (ref, text) => {
  return `<span id="${footnotePrefix}:${ref}">${ref}:</span>${text} <a href="#${referencePrefix}:${ref}">↩</a>`;
};
const referenceTemplate = ref => {
  return `<sup class="footnote-ref" id="${referencePrefix}:${ref}"><a href="#${footnotePrefix}:${ref}">[${ref}]</a></sup>`;
};

const interpolateReferences = (text) => {
  return text.replace(referenceMatch, (_, ref) => {
    // console.log(`ref matched ${ref}`, text)
    return referenceTemplate(ref);
  });
}
const interpolateFootnotes = (text) => {
  return text.replace(footnoteMatch, (_, value, text) => {
    // console.log('matched')
    return footnoteTemplate(value, text);
  });
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