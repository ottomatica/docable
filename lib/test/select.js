const chalk = require('chalk');

const Transform  = require('./transform');

const tr = new Transform();

class Select {
    constructor(op, selector) 
    {
        this.op = op;
        this.selector = selector;
    }

    asContainsNext($, searchText)
    {
        if (this.selector)
            return $(`*:contains("${searchText.trim()}")`).next(this.selector).text();
        else
            return $(`p:contains("${searchText.trim()}")`).next('pre').text();
    }

    asContainsNextElement($, searchText)
    {
        if (this.selector)
            return $(`*:contains("${searchText.trim()}")`).next(this.selector);
        else
            return $(`p:contains("${searchText.trim()}")`).next('pre');
    }

    splitLines(content)
    {
        let lines = content.split(/\r?\n/);
        return lines;
    }

    async selectAsFile(content, destination, user, persistent, target)
    {
        return new Promise(async (resolve, reject) => 
        {
            try {
                let output = await this.op.file( content, destination, user, persistent, target);
                if(output.stderr) console.log(chalk`{red error: ${output.stderr}}`)
                resolve({status: output.exitCode == 0, error: output.stderr, exitCode: output.exitCode, stdout: output.stdout});
            } catch(err) {
                console.log(chalk`{red error: ${err}}`)
                resolve({error: err, exitCode: output.exitCode, stdout: output.stdout, status: false});
            }
        });

    }

    async selectAndExpect(content, external, user, persistent, target)
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

            let serverResponse = await this.op.run(cmd, user, persistent, target);
            let output = serverResponse.stdout.trimRight();
            if( this.splitLines(expect).every( line => output.includes(line.trim())) )
            {
                console.log(chalk`{green Received expected response: ${serverResponse.stdout}}`);
                resolve({status: true});
            }
            else{
                console.log(chalk`{red expected ${serverResponse.stdout} == ${expect}}`);
                console.log(chalk`{red error: ${serverResponse.stderr}}`)
                resolve({error: serverResponse.stderr, exitCode: serverResponse.exitCode, stdout: serverResponse.stdout, status: false});
            }
        });
    }

    async selectAndRun(content, user, persistent, target)
    {
        return new Promise(async(resolve, reject) => 
        {
            let cmd = tr.trimPrompt(content);

            // server...
            try {
                let output = await this.op.run(cmd, user, persistent, target);
                if(output.stderr) console.log(chalk`{red error: ${output.stderr}}`)
                resolve({status: output.exitCode == 0, error: output.stderr, exitCode: output.exitCode, stdout: output.stdout});
            } catch(err) {
                console.log(chalk`{red error: ${err}}`)
                resolve({error: err, exitCode: output.exitCode, stdout: output.stdout, status: false});
            }
        });
    }

    // TODO: add persistent
    async selectAndServe(content, user, persistent, target)
    {
        return new Promise(async(resolve, reject) => 
        {
            let cmd = tr.trimPrompt(content);

            // server...
            try {
                await this.op.running(cmd, user, persistent, target);
                resolve({status: true, stdout: "", exitCode: "", error: ''});
            } catch(err) {
                console.error(err);
                resolve({error: err, stdout: "", exitCode: "", status: false});
            }
        });
    }

}

module.exports = Select;