const chalk = require('chalk');
const path  = require('path');
const os    = require('os');
const hostUsername = os.userInfo().username;

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
    async file(content, location, user, persistent)
    {
        console.log(chalk`{blue placing contents in file:} {rgb(173,216,230) ${location}}\n${content.substring(0,50)}...`);
        let output;
        if(location.includes('/'))
            output = await this.connector.exec( `${this.sudoCMD(user)} tee ${location.trim()} << 'END'\n${content}\nEND\n`);
        else {
            if (persistent) output = await this.connector.execPersistent(`${this.sudoCMD(user)} tee ${path.join(this.cwd, location.trim())} << 'END'\n${content}\nEND\n`, persistent);
            else output = await this.connector.exec(`${this.sudoCMD(user)} tee ${path.join(this.cwd, location.trim())} << 'END'\n${content}\nEND\n`);
        }

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        return output;
    }

    // Long running command...
    // TODO: add spawnPersistent?
    async running(cmd, user, persistent)
    {
        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        let results = await this.connector.spawn(`${this.sudoCMD(user)} ${cmd}`, {cwd: this.cwd});
        if( results.pid )
        {
            console.log( `Spawned pid: ${results.pid}`);
            this.spawnedPids.push( results.pid );
        }
        // // Need time to let background commands be ready for follow-on commands.
        await this.sleep(500);
    }

    // Simple command
    async run(cmd, user, persistent)
    {
        console.log(chalk`{green running...}\n${cmd}`);
        let output;

        if (persistent) output = await this.connector.execPersistent(`cd ${this.cwd} && ${this.sudoCMD(user)} ` + cmd, persistent);
        else output = await this.connector.exec(`cd ${this.cwd} && ${this.sudoCMD(user)} ` + cmd);

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

    sudoCMD(user) {
        if (user && this.connector.sshConfig && this.connector.sshConfig.user != user)
            return `sudo -u ${user}`;
        else
            return '';
    }
}


module.exports = Operators;
