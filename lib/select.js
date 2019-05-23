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

    async selectAndExpect(content)
    {
        let {cmd, expect} = tr.commandExpects(content);
        cmd = tr.trimPrompt(cmd);

        let serverResponse = await this.op.run(cmd);

        if(serverResponse.trimRight() != expect )
        {
            console.log(chalk`{red expected ${serverResponse} == ${expect}}`);
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
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