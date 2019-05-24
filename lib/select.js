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

    async selectAsFile(content, destination)
    {
        await this.op.file( content, destination);
    }

    async selectAndRun(content)
    {

    }

    async selectAndExpect(content, $, searchText)
    {
        let {cmd, expect} = tr.commandExpects(content);
        cmd = tr.trimPrompt(cmd);

        let serverResponse = await this.op.run(cmd);

        let temp = $(`p:contains("${searchText.trim()}")`).next().text();

        if(serverResponse.trimRight() != expect )
        {
            console.log(chalk`{red expected ${serverResponse} == ${expect}}`);
            $(`p:contains("${searchText.trim()}")`).next().text('𐄂 ' + temp)
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
            $(`p:contains("${searchText.trim()}")`).next().text('✓ ' + temp)
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