const chalk = require('chalk');
const path  = require('path');

class Operators {
    constructor(connector, cwd)
    {
        this.connector = connector;
        this.cwd = cwd;
        this.spawnedPids = [];
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    // Place content as file
    async file(content, location)
    {
        console.log(chalk`{blue placing contents in file:} {rgb(173,216,230) ${location}}\n${content.substring(0,50)}...`);
        let output;
        if(location.includes('/'))
            output = await this.connector.exec( `cat << 'END' > ${location.trim()}\n${content}\nEND\n`);
        else
            output = await this.connector.exec( `cat << 'END' > ${path.join(this.cwd, location.trim())}\n${content}\nEND\n`);

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        console.log(JSON.stringify(output));
    }

    // Long running command...
    async running(cmd)
    {
        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        let results = await this.connector.spawn(`${cmd}`, {cwd: this.cwd});
        if( results.pid )
        {
            console.log( `Spawned pid: ${results.pid}`);
            this.spawnedPids.push( results.pid );
        }
        // // Need time to let background commands be ready for follow-on commands.
        await this.sleep(500);
    }

    // Simple command
    async run(cmd)
    {
        console.log(chalk`{green running...}\n${cmd}`);
        let output = await this.connector.exec(`cd ${this.cwd} && ` + cmd);
        return output;
    }

    async tearDown()
    {
        if( this.spawnedPids.length > 0 )
        {
            console.log(chalk`{rgb(255,136,0) Tearing down background commands with pids: ${this.spawnedPids.join(',')}}`);
            for( let pid of this.spawnedPids )
            {
                await this.connector.exec(`kill -9 ${pid}`);
            }
        }
    }
}


module.exports = Operators;
