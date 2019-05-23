const Connector = require('infra.connectors');

class Infra {
    constructor() 
    {
    }

    static async setup(kind, setupFile, name)
    {
        let conn = Connector.getConnector(kind, name);
        console.log('Headless infrastructure is:', await conn.getState());

        if( await conn.getState().catch(e => false) === "running" )
        {
        }
        else
        {
            console.log("Preparing headless infrastructure one-time build")
            child.execSync(`slim build ${infra}`, {stdio:"inherit"});
            child.execSync(`slim delete vm phpx`, {stdio:"inherit"});
            child.execSync(`slim run phpx ${path.basename(infra)}`, {stdio:"inherit"});
            conn = Connector.getConnector('slim', name);
            //let status = await conn.ready();
            //console.log(`Infrastructure status is ready: ${status}`);
        }
        
        return conn;
    }


}


module.exports = Infra;