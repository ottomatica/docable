const chalk = require('chalk');
const fs = require('fs-extra');
const md5 = require('md5');
const mustache = require('mustache');
const path = require('path');
const Transform = require('./transform');

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
            return $(`*:contains("${searchText.trim()}")`).nextAll(this.selector).first().text();
        else
            return $(`p:contains("${searchText.trim()}")`).nextAll('pre').first().text();
    }

    asContainsNextElement($, searchText)
    {
        if (this.selector)
            return $(`*:contains("${searchText.trim()}")`).nextAll(this.selector).first();
        else
            return $(`p:contains("${searchText.trim()}")`).nextAll('pre').first();
    }

    splitLines(content)
    {
        let lines = content.split(/\r?\n/);
        return lines;
    }

    async selectAsFile(content, destination, user, persistent, target, permission)
    {
        return new Promise(async (resolve, reject) => 
        {
            let output = {};
            try {
                output = await this.op.file( content, destination, user, persistent, target, permission);
                if(output.stderr) console.log(chalk`{red error: ${output.stderr}}`)
                resolve({status: output.exitCode == 0, error: output.stderr, exitCode: output.exitCode, stdout: output.stdout});
            } catch(err) {
                console.log(chalk`{red error: ${err}}`)
                resolve({error: err, exitCode: output.exitCode, stdout: output.stdout, status: false});
            }
        });

    }

    async generateExpectScript(input, user, target) {
        const template = await fs.readFile(path.resolve(__dirname, './input.mustache'), { encoding: 'utf8' });
        const cmd_md5 = md5(input.cmd);
        const cmdScript = `/tmp/${cmd_md5}.sh`;
        await this.op.file(`${input.cmd.trimRight()} > /tmp/${cmd_md5}.stdout 2> /tmp/${cmd_md5}.stderr\necho $? >> /tmp/${cmd_md5}.stdout`, cmdScript, user, false, target, 'x');
        input.cmd = cmdScript.toString();
        const expectScript = mustache.render(template, input);
        const expectScriptPath = `/tmp/${cmd_md5}.expect`;
        await this.op.file(expectScript, expectScriptPath, user, false, target, 'x');

        // ensuring expect is installed
        // TODO: is there a better way to check this?
        await this.op.run('command -v expect || sudo apt-get update && sudo apt-get install -y expect && sudo rm /var/lib/apt/lists/*', user, undefined, target);
        await this.op.run(expectScriptPath, user, undefined, target);

        return `( cat /tmp/${cmd_md5}.stdout && cat /tmp/${cmd_md5}.stderr >&2 )`;
    }

    async selectAndExpect(content, external, user, persistent, target, opts)
    {
        if(opts.prompts) {
            let input = {cmd: content, prompts: opts.prompts}
            const expectScript = await this.generateExpectScript(input, user, target);
            // await this.op.run(expectScript, user, persistent, target)
            // content = `cat /tmp`
            content = await this.generateExpectScript(input, user, target);
            console.log('running input');
        }

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

            // updating exitCode
            if (opts.prompts) {
                let stdout = output.stdout.split('\n');
                let exitCode = stdout.splice(-1);
                output.stdout = stdout.join('\n');
                output.exitCode = exitCode;
            }

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

    async selectAndRun(content, user, persistent, target, opts)
    {
        // opts.prompts = [
        //     {prompt: 'prompt', answer: 'answer'}
        // ]
        if (opts.prompts) {
            let input = { cmd: content, prompts: opts.prompts }
            content = await this.generateExpectScript(input, user, target);
            console.log('running input');
        }

        return new Promise(async(resolve, reject) => 
        {
            let cmd = tr.trimPrompt(content);

            // server...
            try {
                let output = await this.op.run(cmd, user, persistent, target);
                
                // updating exitCode
                if (opts.prompts) {
                    let stdout = output.stdout.split('\n');
                    let exitCode = stdout.splice(-1);
                    output.stdout = stdout.join('\n');
                    output.exitCode = exitCode;
                }
                
                if (output.stderr) console.log(chalk`{red error: ${output.stderr}}`);
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