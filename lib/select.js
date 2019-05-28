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
        return new Promise(async (resolve, reject) => 
        {
            try {
                await this.op.file( content, destination);
                resolve({status: true});
            } catch(err) {
                console.error(err);
                resolve({error: err, status: false});
            }
        });

    }

    async selectAndRun(content)
    {

    }

    async selectAndExpect(content)
    {
        return new Promise(async(resolve, reject) => 
        {
            let {cmd, expect} = tr.commandExpects(content);
            cmd = tr.trimPrompt(cmd);

            let serverResponse = await this.op.run(cmd);

            if(serverResponse.trimRight() != expect )
            {
                console.log(chalk`{red expected ${serverResponse} == ${expect}}`);
                resolve({error: serverResponse, status: false});
            }
            else{
                console.log(chalk`{green Received expected response: ${serverResponse}}`);
                resolve({status: true});
            }
        });
    }

    async selectAndServe(content)
    {
        return new Promise(async(resolve, reject) => 
        {
            let cmd = tr.trimPrompt(content);

            // server...
            try {
                await this.op.running(cmd);
                resolve({status: true});
            } catch(err) {
                console.error(err);
                resolve({error: err, status: false});
            }
        });
    }

}

module.exports = Select;