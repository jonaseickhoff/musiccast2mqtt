import { MusiccastDevice } from "./musiccast-device";
import { MusiccastCommands } from "./musiccast-commands";
import { MusiccastGroupMananger} from './musiccast-group-manager';
import { McZoneId } from "./musiccast-features";

export class MusiccastCommandMapping {

  static async ExecuteCommand(device: MusiccastDevice, command: MusiccastCommands, payload: any, zone: McZoneId = McZoneId.Main): Promise<any> {
    switch(command) {
      case MusiccastCommands.JoinGroup:
     
      case MusiccastCommands.LeaveGroup:

      case MusiccastCommands.Mute:

      case MusiccastCommands.Next:
   
      case MusiccastCommands.Pause:

      case MusiccastCommands.Play:

      case MusiccastCommands.PlayMode:       

      case MusiccastCommands.Previous:
         
      case MusiccastCommands.Sleep:

      case MusiccastCommands.Speak:

      case MusiccastCommands.Stop:
      
      case MusiccastCommands.SwitchTo:

      case MusiccastCommands.Toggle:

      case MusiccastCommands.Unmute:

      case MusiccastCommands.Volume:

      case MusiccastCommands.VolumeDown:
          
      case MusiccastCommands.VolumeUp:
      
      default:
        throw new Error(`Command '${command}' not implemented`)
    }
  }

}