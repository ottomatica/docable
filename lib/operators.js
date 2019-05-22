const chalk = require('chalk');

class Operators {
    constructor(connector) 
    {
        this.connector = connector;
    }

    // Place content as file
    async file(content, location)
    {
        console.log(chalk`{blue placing contents in file:} {rgb(173,216,230) ${location}}\n${content.substring(0,50)}...`);
        let output = await this.connector.exec(null, `cat << 'END' > ${location}\n${content}\nEND\n`);
        console.log(output);
    }

    // Long running command...
    async running(cmd)
    {
        // cmd = cmd + " &"
        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        return this.connector.exec(null, cmd);
    }

    // Simple command
    async run(cmd)
    {
        console.log(chalk`{green running...}\n${cmd}`);
        let output = await this.connector.exec(null, cmd);
        return output;
    }
}


module.exports = Operators;