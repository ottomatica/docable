const chalk = require('chalk');

class Operators {
    constructor(connector) 
    {
        this.connector = connector;
    }

    // Place content as file
    async file(content, location)
    {
        let output = await this.connector.exec(null, `cat << 'END' > ${location}\n${content}\nEND\n`);
        console.log(output);
    }

    // Long running command...
    async running(cmd)
    {
        let output = await this.connector.exec(null, cmd);
        console.log(output);
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