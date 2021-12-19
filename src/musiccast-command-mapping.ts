import { MusiccastCommands } from "./musiccast-commands";
import { MusiccastGroupMananger } from './musiccast-group-manager';
import { MusiccastZone } from "./musiccast-zone";

export class MusiccastCommandMapping {

  static async ExecuteCommand(zone: MusiccastZone, command: MusiccastCommands, payload: any): Promise<any> {
    switch (command) {
      case MusiccastCommands.JoinGroup:
        if (payloadIsString(payload)) {
          await MusiccastGroupMananger.getInstance().queuelinkById(payload, [zone.id]);
        }
        break;

      case MusiccastCommands.LeaveGroup:
        await MusiccastGroupMananger.getInstance().queueunlinkFromServer(zone);
        break;

      case MusiccastCommands.AddClients:
        let addedClients: string[];
        if (payloadIsString(payload)) {
          addedClients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          addedClients = payload;
        }
        await MusiccastGroupMananger.getInstance().queuelinkById(zone, addedClients);
        break;

      case MusiccastCommands.RemoveClients:
        let removedClients: string[];
        if (payloadIsString(payload)) {
          removedClients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          removedClients = payload;
        }
        await MusiccastGroupMananger.getInstance().queueunlinkById(zone, removedClients);
        break;

      case MusiccastCommands.Clients:
        let clients: string[];
        if (payloadIsString(payload)) {
          clients = payload.split(',').filter((c: string) => c !== '');
        } else if (Array.isArray(payload)) {
          clients = payload;
        }
        await MusiccastGroupMananger.getInstance().queuesetLinksById(zone, clients);
        break;

      case MusiccastCommands.Server:
        if (payloadIsString(payload)) {
          if (payload.trim() === '') {
            await MusiccastGroupMananger.getInstance().queueunlinkFromServer(zone);
          } else {
            await MusiccastGroupMananger.getInstance().queuelinkById(payload, [zone.id]);
          }
        }
        break;

      case MusiccastCommands.Next:
        await zone.next();
        break;

      case MusiccastCommands.Previous:
        await zone.previous();
        break;

      case MusiccastCommands.Pause:
        await zone.pause();
        break;

      case MusiccastCommands.Play:
        await zone.play();
        break;

      case MusiccastCommands.Stop:
        await zone.stop();
        break;

      case MusiccastCommands.PlayPosition:
        if (payloadIsNumber(payload))
          await zone.playPosition(payload)
        break;

      case MusiccastCommands.Repeat:
        if (payloadIsString(payload))
          await zone.setRepeat(payload);
        break;

      case MusiccastCommands.Shuffle:
        if (payloadIsString(payload))
          await zone.setShuffle(payload);
        break;

      case MusiccastCommands.ToggleRepeat:
        await zone.toggleRepeat();
        break;

      case MusiccastCommands.ToggleShuffle:
        await zone.toggleShuffle();
        break;

      case MusiccastCommands.Sleep:
        if (payloadIsNumber(payload))
          await zone.sleep(payload);
        break;

      case MusiccastCommands.Speak:
        break;

      case MusiccastCommands.Input:
        if (payloadIsString(payload))
          await zone.setInput(payload);
        break;

      case MusiccastCommands.Soundprogram:
        if (payloadIsString(payload))
          await zone.setSoundprogram(payload);
        break;

      case MusiccastCommands.Power:
        await zone.power((payload === "on" || payload === true || payload === "true"));
        break;

      case MusiccastCommands.Mute:
        await zone.mute(true);
        break;

      case MusiccastCommands.Unmute:
        await zone.mute(false);
        break;

      case MusiccastCommands.Volume:
        if (payloadIsNumber(payload))
          await zone.setVolume(payload);
        break;

      case MusiccastCommands.VolumeDown:
        await zone.volumeDown();
        break;

      case MusiccastCommands.VolumeUp:
        await zone.volumeUp();
        break;
      
      case MusiccastCommands.RecallPreset:
        if (payloadIsNumber(payload))
          await zone.recallPreset(payload);
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