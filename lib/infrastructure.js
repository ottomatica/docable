const path = require('path');
const Connector = require('infra.connectors');

class Infra {
    constructor()
    {
    }

    static async select(doc, provider, cwd)
    {
        let name = `${path.basename(cwd)}-docable-vm`;
        let conn = Connector.getConnector(provider, name );
        switch( provider )
        {
            case 'slim':
            {
                let image = doc.setup[provider].image;

                if( await conn.getState(name).catch(() => false) === "running" ) { break; }
                if( !await conn.isImageAvailable(image) )
                {
                    console.log("Preparing slim one-time build")
                    await conn.build( path.join( cwd, image ));
                }
                await conn.delete(name);
                await conn.provision( name, image );
                // wait for port to be forwarded
                // await new Promise(resolve => setTimeout(resolve, 10000));
                console.log('Waiting for VM to be ready');
                let status = await conn.ready();
                //console.log(`Infrastructure status is ready: ${status}`);

                break;
            }
            case 'local':
            {
                break;
            }
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        console.log(`Headless infrastructure is using '${provider}' provider and is: '${await conn.getState(name)}'`);
        return conn;
    }
}


module.exports = Infra;
