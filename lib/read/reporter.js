const fs = require('fs');
const path = require('path');

class Reporter {
    constructor($, results) {
        this.$ = $;
        this.results = results;
    }

    async report () {
        let docStatus = true;
        for(const result of this.results) {
            // selecting cells using index to add results for report
            let selector = this.$('[data-docable="true"]').eq(result.cell.index);
            this.setResults(selector, result.result);

            docStatus = docStatus && result.result.status;
        }

        // .passing { background-color: #BDFCC9 !important }
        // .failing { background-color: LightCoral !important }

        await fs.promises.writeFile(path.join(process.cwd(), 'docable_report.html'), this.$.html(), {encoding: 'utf-8'});

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
}

module.exports = Reporter;
