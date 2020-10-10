import { Socket, createSocket, RemoteInfo } from 'dgram'
import { StaticLogger } from './static-logger';
import { ConfigLoader} from './config';


export interface eventCallback { (event: any): void }

export class MusiccastEventListener {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastEventListener.main');

    private static instance: MusiccastEventListener;
    private readonly port: number;
    private isListening: boolean;
    private server: Socket;

    private subscriptions: { [device_id: string]: eventCallback } = {};

    static get DefaultInstance(): MusiccastEventListener {
        if (!MusiccastEventListener.instance) {
            MusiccastEventListener.instance = new MusiccastEventListener();
        }
        return MusiccastEventListener.instance;
    }

    constructor() {
        let config = ConfigLoader.Config()
        this.port = config.udpPort;
        this.isListening = false;
        this.server = createSocket("udp4");
        this.server.on('listening', () => this.serverListening());
        this.server.on('message', (message, remote) => this.serverMessage(message, remote));
        this.server.on('close', () => this.serverClose());
        this.server.on('error', (error) => this.serverError(error));
    }

    public RegisterSubscription(device_id: string, callback: eventCallback): void {
        if (this.isListening !== true) {
            this.log.debug('Start listening on port %d', this.port);
            this.isListening = true;
            this.server.bind(this.port);
        }
        this.subscriptions[device_id] = callback;
    }

    public UnregisterSubscription(device_id: string): void {
        delete this.subscriptions[device_id];
        if (this.isListening && Object.keys(this.subscriptions).length === 0) {
            this.log.debug('Stop listening on port %d', this.port);
            this.server.close();
            this.isListening = false;
        }
    }


    public StopListener(): void {
        this.server?.close();
    }

    private serverListening(): void {
        let address = this.server.address();
        this.log.debug('UDP Server listening on ' + address.address + ':' + address.port);
    }

    private serverMessage(message: Buffer, remote: RemoteInfo): void {
        this.log.verbose("New udp message: {message}", remote.address + ':' + remote.port + ' - ' + message);
        try {
            let event = JSON.parse(message.toString());
            let callback: eventCallback = this.subscriptions[event.device_id];
            if (callback !== undefined)
                callback(event);
            else {
                this.log.warn("New udp message from unknown device: {message}", remote.address + ':' + remote.port + ' - ' + message);
            }
        }catch(error){
            this.log.error("Error while receiving udp event: {error}", error)
        }
    }

    private serverClose() {
        this.log.debug('UDP Server closed');
        this.isListening = false;
    }

    private serverError(error: Error) {
        this.log.debug('UDP Server error {name}: {message} ', error.name, error.message);
    }
}