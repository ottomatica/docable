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
        try {
            await this.op.file( content, destination);
            return {status: true};
        } catch(err) {
            console.error(err);
            return {error: err, status: false};
        }
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
            return {error: serverResponse, status: false};
        }
        else{
            console.log(chalk`{green Received expected response: ${serverResponse}}`);
            return {status: true};
        }
    }

    async selectAndServe(content)
    {
        let cmd = tr.trimPrompt(content);

        // server...
        try {
            await this.op.running(cmd);
            return {status: true};
        } catch(err) {
            console.error(err);
            return {error: err, status: false};
        }
    }

}

module.exports = Select;