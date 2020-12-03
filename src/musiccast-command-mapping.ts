import { MusiccastDevice } from "./musiccast-device";
import { MusiccastCommands } from "./musiccast-commands";
import { MusiccastGroupMananger } from './musiccast-group-manager';
import { McZoneId } from "./musiccast-features";

export class MusiccastCommandMapping {

  static async ExecuteCommand(device: MusiccastDevice, command: MusiccastCommands, payload: any, zone: McZoneId = McZoneId.Main): Promise<any> {
    switch (command) {
      case MusiccastCommands.JoinGroup:
        if (payloadIsString(payload)) {
          await MusiccastGroupMananger.getInstance().linkById(payload, [device.id]);
        }
        break;

      case MusiccastCommands.LeaveGroup:
        await MusiccastGroupMananger.getInstance().unlinkFromServer(device);
        break;

      case MusiccastCommands.AddClients:
        let addedClients: string[]
        if (payloadIsString) {
          addedClients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          addedClients = payload;
        }
        await MusiccastGroupMananger.getInstance().linkById(device.id, addedClients);
        break;

      case MusiccastCommands.RemoveClients:
        let removedClients: string[]
        if (payloadIsString) {
          removedClients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          removedClients = payload;
        }
        await MusiccastGroupMananger.getInstance().unlinkById(device.id, removedClients);
        break;

      case MusiccastCommands.SetClients:
        let clients: string[]
        if (payloadIsString) {
          clients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          clients = payload;
        }
        await MusiccastGroupMananger.getInstance().setLinksById(device.id, clients);
        break;

      case MusiccastCommands.Next:
        await device.nextNet();
        break;

      case MusiccastCommands.Previous:
        await device.prevNet();
        break;

      case MusiccastCommands.Pause:
        await device.pauseNet();
        break;

      case MusiccastCommands.Play:
        await device.playNet();
        break;

      case MusiccastCommands.Stop:
        await device.stopNet();
        break;

      case MusiccastCommands.Repeat:
        await device.toggleNetRepeat();
        break;

      case MusiccastCommands.Shuffle:
        await device.toggleNetShuffle();
        break;

      case MusiccastCommands.Sleep:
        if (payloadIsNumber) {
          await device.sleep(payload, zone);
        }
        break;

      case MusiccastCommands.Speak:
        break;


      case MusiccastCommands.SwitchTo:
        if (payloadIsString(payload)) {
          await device.setInput(payload, zone)
        }
        break;

      case MusiccastCommands.Toggle:

        break;

      case MusiccastCommands.Power:
        await device.power((payload === "on" || payload === true || payload === "true"), zone);
        break;

      case MusiccastCommands.Mute:
        await device.muteOn(zone);
        break;

      case MusiccastCommands.Unmute:
        await device.muteOff(zone);
        break;

      case MusiccastCommands.Volume:
        if (payloadIsNumber(payload)) {
          let level: number = Math.round(payload / 100 * (device.getVolumeMax(zone) - device.getVolumeMin(zone)));
          if (level < device.getVolumeMin(zone))
            level = device.getVolumeMin(zone);
          else if (level > device.getVolumeMax(zone))
            level = device.getVolumeMax(zone);
          await device.setVolumeTo(level, zone);
        }
        break;

      case MusiccastCommands.VolumeDown:
        let levelDown: number = device.getVolume(zone) - device.getVolumeStep(zone);
        if (levelDown < device.getVolumeMin(zone))
          levelDown = device.getVolumeMin(zone);
        else if (levelDown > device.getVolumeMax(zone))
          levelDown = device.getVolumeMax(zone);
        await device.setVolumeTo(levelDown, zone);
        break;

      case MusiccastCommands.VolumeUp:
        let levelUp: number = device.getVolume(zone) + device.getVolumeStep(zone);
        if (levelUp < device.getVolumeMin(zone))
          levelUp = device.getVolumeMin(zone);
        else if (levelUp > device.getVolumeMax(zone))
          levelUp = device.getVolumeMax(zone);
        await device.setVolumeTo(levelUp, zone);
        break;

      default:
        throw new Error(`Command '${command}' not implemented`)
    }
  }
}

function payloadIsNumber(payload: any): boolean {
  return (typeof payload === 'number');
}

function payloadIsString(payload: any): boolean {
  return (typeof payload === 'string');
}