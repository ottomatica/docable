const chalk = require('chalk');

class Operators {
    constructor(connector) 
    {
        this.connector = connector;
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
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
        this.connector.exec(null, cmd);
        // Need time to let background commands be ready for follow-on commands.
        await this.sleep(1000);
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