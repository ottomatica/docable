const chalk = require('chalk');
const path  = require('path');
const os    = require('os');
const hostUsername = os.userInfo().username;

class Operators {
    constructor(connector, cwd, targets)
    {
        this.connector = connector;
        this.cwd = cwd;
        connector.setCWD(cwd);
        this.spawnedPids = [];
        this.targets = targets;
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    getConnector(name)
    {
        if( name && Object.keys(this.targets).includes(name) )
        {
            console.log(`Retrieving target ${name}`);
            return this.targets[name];            
        }
        return this.connector;
    }

    // Place content as file
    async file(content, location, user, persistent, target, permission)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{blue placing contents in file:} {rgb(173,216,230) ${location}}\n${content.substring(0,50)}...`);
        let output;
        if(location.includes('/'))
            output = await conn.exec( `${this.sudoCMD(user, conn)} tee ${location.trim()} << 'END'\n${content}\nEND\n`);
        else {
            if (persistent) output = await conn.execPersistent(`${this.sudoCMD(user, conn)} tee ${location.trim()} << 'END'\n${content}\nEND\n`, persistent);
            else output = await conn.exec(`${this.sudoCMD(user, conn)} tee ${location.trim()} << 'END'\n${content}\nEND\n`);
        }

        if (permission) {
            await conn.exec(`${this.sudoCMD(user, conn)} chmod +${permission} ${location}`);
        }

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        return output;
    }

    // Long running command...
    // TODO: add spawnPersistent?
    async running(cmd, user, persistent, target)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        let results = await conn.spawn(`${this.sudoCMD(user, conn)} ${cmd}`, {cwd: this.cwd});
        if( results.pid )
        {
            console.log( `Spawned pid: ${results.pid}`);
            this.spawnedPids.push( results.pid );
        }
        // // Need time to let background commands be ready for follow-on commands.
        await this.sleep(500);
    }

    // Simple command
    async run(cmd, user, persistent, target)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{green running...}\n${cmd}`);
        let output;

        if (persistent) output = await conn.execPersistent(`${this.sudoCMD(user, conn)} ` + cmd, persistent);
        else output = await conn.exec(`${this.sudoCMD(user, conn)} ` + cmd);

        return output;
    }

    // TODO need to associate pids with targets/connector.
    async tearDown(targets)
    {
        //let conn = this.getConnector(targets);
        if( this.spawnedPids.length > 0 )
        {
            console.log(chalk`{rgb(255,136,0) Tearing down background commands with pids: ${this.spawnedPids.join(',')}}`);
            for( let pid of this.spawnedPids )
            {
                await this.connector.exec(`kill -9 ${pid}`);
            }
        }
    }

    sudoCMD(user, conn) {

        if (user && conn.sshConfig && conn.sshConfig.user != user)
            return `sudo -u ${user}`;
        else
            return '';
    }
}

module.exports = Operators;
