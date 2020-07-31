const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

class Reporter {
    constructor($, results) {
        this.$ = $;
        this.results = results;
    }

    async report(reportPath = '.') {
        let docStatus = true;
        for(const result of this.results) {
            // selecting cells using index to add results for report
            let selector = this.$('[data-docable="true"]').eq(result.cell.index);
            this.setResults(selector, result.result);

            docStatus = docStatus && result.result.status;
        }

        // .passing { background-color: #BDFCC9 !important }
        // .failing { background-color: LightCoral !important }

        await fs.promises.writeFile(path.join(process.cwd(), reportPath, 'docable_report.html'), await this.renderHtml(this.$.html()), { encoding: 'utf-8' });

        return docStatus;
    }

    async setResults(selector, result) {
        if (!result) return;

        if (result.status)
            await this._setPassing(selector);
        else
            await this._setFailing(selector, result);
        return result;
    }

    async _setPassing(selector) {
        selector.prepend('<span>✓ </span>');
        selector.addClass('passing');
    }

    async _setFailing(selector, response) {
        selector.prepend('<span>𐄂 </span>');
        selector.append(`<br/><br/>`);
        selector.append(`<span>️ error: ${response.error || response.stderr}</span> </br>`);
        selector.append(`<span> exit code: ${response.exitCode}</span> </br>`);
        selector.append(`<span> command output: ${response.stdout || '""'}</span> </br>`);
        selector.addClass('failing');
    }

    async renderHtml(body, options = {}) {
        let $ = cheerio.load('<!doctype html>');

        $('head').append(
            `<meta content="text/html;charset=utf-8" http-equiv="Content-Type">
            <meta content="utf-8" http-equiv="encoding"></meta>`
        );

        let localStyle = `<style>` +
                            await fs.promises.readFile(path.join(__dirname, './css/github-markdown.css')) +
                            `.passing { background-color: #ccffcc!important; }` +
                            `.failing { background-color: #ffb3b3!important; }` +
                        `</style>`;

        $('head').append(localStyle);

        $('head').append(
            `<link rel="stylesheet" href="http://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.1.1/styles/default.min.css" />`,
            `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.1.1/highlight.min.js"></script>`
        );

        if (options.imgRoot && options.imgRoot != './') {
            // Rewrite remote imgs to be use remote imgRoot.
            $('img').each(function () {
                const link = $(this).attr('src');
                if (!link.startsWith('http') && !link.startsWith('//')) {
                    let fixedUrl = options.imgRoot + link;
                    $(this).attr('src', fixedUrl);
                }
            });
        }

        if (options.sidebar) {
            // console.log(JSON.stringify( options.sidebar ));
            const output = Mustache.render(options.sidebar.template, options.sidebar.view);
            console.log(output);
            let sidebar = await marked(output);

            $.root().append(
                `<div class="sidebar">
            ${sidebar}
            </div>`
            );
        }

        $.root().append(`<div class="main"><article class="markdown-body"></article></div>`);
        $('.markdown-body').append(body);

        return $.html();
    }
}

module.exports = Reporter;
