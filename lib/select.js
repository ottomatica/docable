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

    async selectAsFile(content, destination)
    {
        await this.op.file( content, destination);
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
            this.asContainsNextElement($, searchText).text('𐄂 ' + content);
            this.asContainsNextElement($, searchText).css('background-color', 'LightCoral')
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
            this.asContainsNextElement($, searchText).text('✓ ' + content);
            this.asContainsNextElement($, searchText).css('background-color', 'LightGreen')
        }
    }

    async selectAndServe(content)
    {
        let cmd = tr.trimPrompt(content);

        // server...
        await this.op.running(cmd);
    }



}

module.exports = Select;