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

    async selectAndExpect(content, external)
    {
        return new Promise(async(resolve, reject) => 
        {
            let {cmd, expect} = tr.commandExpects(content);
            if( external )
            {
                expect = external;
                cmd = content;
            }
            cmd = tr.trimPrompt(cmd);

            let serverResponse = await this.op.run(cmd);

            if(serverResponse.stdout.trimRight() != expect )
            {
                console.log(chalk`{red expected ${serverResponse.stdout} == ${expect}}`);
                resolve({error: serverResponse.stdout + serverResponse.stderr, status: false});
            }
            else{
                console.log(chalk`{green Received expected response: ${serverResponse.stdout}}`);
                resolve({status: true});
            }
        });
    }

    async selectAndRun(content)
    {
        return new Promise(async(resolve, reject) => 
        {
            let cmd = tr.trimPrompt(content);

            // server...
            try {
                let output = await this.op.run(cmd);
                resolve({status: output.exitCode == 0, error: output.stderr});
            } catch(err) {
                resolve({error: err, status: false});
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