const path = require('path');
const Connector = require('infra.connectors');

class Infra {
    constructor()
    {
    }

    static async select(doc, provider, cwd)
    {
        let opts = {};
        if (provider === 'slim') {
            // choose slim provider (ie vbox, kvm, etc)
            opts['provider'] = doc.setup[provider].provider || undefined;
        }
        let name = `${path.basename(cwd)}-docable-vm`;
        let conn = Connector.getConnector(provider, name, opts);
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

                // passthrough options in setup directly.
                let options = doc.setup[provider];
                await conn.provision( name, image, options );
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
