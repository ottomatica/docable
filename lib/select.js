const chalk = require('chalk');

const Transform  = require('./transform');

const tr = new Transform();

class Select {
    constructor(op) 
    {
        this.op = op;
    }

    asContainsNext($, searchText)
    {
        // $('p:contains("start it:")').next().text()
        return $(`p:contains("${searchText.trim()}")`).next().text();
    }

    asContainsNextElement($, searchText)
    {
        return $(`p:contains("${searchText.trim()}")`).next();
    }

    async selectAsFile($, searchText, destination)
    {
        const content = this.asContainsNext($, searchText);
        try {
            await this.op.file( content, destination);
            this._setPassing($, searchText);
        } catch(err) {
            this._setFailing($, searchText);
            console.error(err);
        }
    }

    async selectAndRun(content)
    {

    }

    async selectAndExpect($, searchText)
    {
        const content = this.asContainsNext($, searchText);

        let {cmd, expect} = tr.commandExpects(content);
        cmd = tr.trimPrompt(cmd);

        let serverResponse = await this.op.run(cmd);

        if(serverResponse.trimRight() != expect )
        {
            console.log(chalk`{red expected ${serverResponse} == ${expect}}`);
            this._setFailing($, searchText);
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
            this._setPassing($, searchText);
        }
    }

    async selectAndServe($, searchText)
    {
        const content = this.asContainsNext($, searchText);
        let cmd = tr.trimPrompt(content);

        // server...
        try {
            await this.op.running(cmd);
            this._setPassing($, searchText);
        } catch(err) {
            this._setFailing($, searchText);
            console.error(err);
        }
    }

    _setPassing($, searchText) 
    {
        const content = this.asContainsNext($, searchText);
        this.asContainsNextElement($, searchText).text('✓ ' + content);
        this.asContainsNextElement($, searchText).css('background-color', 'LightGreen');
    }

    _setFailing($, searchText)
    {
        const content = this.asContainsNext($, searchText);
        this.asContainsNextElement($, searchText).text('𐄂 ' + content);
        this.asContainsNextElement($, searchText).css('background-color', '#BDFCC9');
    }

}

module.exports = Select;