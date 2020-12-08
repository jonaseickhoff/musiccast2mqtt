export interface McFeatures {
    /** Returns system's overall info */
    system: {
        /** Returns valid functions
        Values: "wired_lan" / "wireless_lan" / "wireless_direct" / "extend_1_band" / "dfs_option" / "network_standby" / "network_standby_auto" / "bluetooth_standby" / "bluetooth_tx_setting" / "auto_power_standby" / "ir_sensor" / "speaker_a" / "speaker_b" / "headphone" / "dimmer" / "zone_b_volume_sync" / " hdmi_out_1" / "hdmi_out_2" / "hdmi_out_3" / "airplay" / "stereo_pair" / "speaker_settings" / "disklavier_settings" / "background_download" / "remote_info" / "network_reboot" / ”system_reboot” / "auto_play" / "speaker_pattern" / "party_mode" */
        func_list: McDeviceFunctions[];
        /** Returns Zone numbers. Zone B is treated as Zone2 in YXC so a Device with ZoneB returns 2. A Device without Zones returns 1 */
        zone_num: number;
        /**  Returns a list of inputs */
        input_list: {
            id: McInputId;
            /** Returns whether an input can be a source of Link distribution */
            distribution_enable: boolean;
            /** Returns whether an input can be renamed */
            rename_enable: boolean;
            /** Return whether an input comes with an account info*/
            account_enable: boolean;
            /** Returns a type of playback info. Depending on this type, use specific API to retrieve appropriate playback info Values: "none" / "tuner" / "netusb" / "cd" */
            play_info_type: "none" | "tuner" | "netusb" | "cd"
        }[];
        /** Returns minimum/maximum/step values of a parameter */
        range_step: McRangeStep[];
        /** Returns Zone related information */
    }
    zone: McZoneFeatures[];
}

export interface McRangeStep {
    /** Returns an ID*/
    id: string;
    /** Returns a minimum value of a parameter */
    min: number;
    /** Returns a maximum value of a parameter */
    max: number;
    /** Returns a step value of a parameter */
    step: number;
}

export interface McZoneFeatures {
    id: McZoneId;
    /** Returns whether the target Zone is Zone B or not. Valid only when Zone ID is "zone2" */
    zone_b: boolean;
    /** Returns a list of valid functions
    Values: "power" / "sleep" / "volume" / "mute" / "sound_program" /
    "direct" / "pure_direct" / "enhancer" / "tone_control" / "equalizer" /
    "balance" / "dialogue_level" / "dialogue_lift" / "clear_voice" /
    "subwoofer_volume" / "bass_extension" / "signal_info" /
    "prepare_input_change" / "link_control" / "link_audio_delay" */
    func_list: string[];
    /** Returns a list of selectable Input IDs */
    input_list: McInputId[];
    /** Returns a list of selectable Sound Program IDs */
    sound_program_list: [McSoundProgram];
    /** Returns selectable settings of Tone Control Mode. If there’s no list
    of this, it’s fixed to "manual"
    Values: "manual" / "auto" / "bypass" */
    tone_controle_mode_list?: string[];
    /** Returns selectable settings of Equalizer Mode. If there’s not list of
    this, it’s fixed to “manual”
    Values: "manual" / "auto" / "bypass" */
    equalizer_mode_list?: string[];
    /** Returns selectable settings of Link Control
    Values: "standard" / "stability" / "speed" */
    link_control_list: string[];
    /**Returns selectable settings of Link Audio Delay
    Values: "lip_sync"/"audio_sync" / "audio_sync_on" / "audio_sync_off" */
    link_audio_delay_list: string[];
    range_step: McRangeStep[];
}

export interface McStatus {
    /** Returns power status */
    power: "on" | "standby";
    /** Returns Sleep Timer steup value (unit in minutes) 
     * Values: 0 / 30 / 60 / 90 / 120
     */
    sleep: number;
    /** Return volume value 
     * Value Range: calculated by minimum/maximum/step values gotten via /system/getFeatures
     */
    volume: number;
    /** Returns mute status */
    mute: boolean;
    /** Returns Max Volume setup
     * Value Range: calculated by minimum/maximum/step values gotten via /system/getFeatures
     */
    max_volume: number;
    /** Returns selected Input ID */
    input: McInputId;
    /** Return wether or not current Input is distributable status */
    distribution_enable: boolean;
    /** Returns selected Sound Program ID
     *  Values: Sound Program IDs gotten via /system/getFeatures
     */
    sound_program: string;
    /** Returns 3D Surround status */
    surround_3d: boolean;
    /** Returns Direct status */
    direct: boolean;
    /** Returns Pure Direct status */
    pure_direct: boolean;
    /** Returns Enhancer status */
    enhancer: boolean;
}

/** Netusb Playback information */
export interface McNetPlayInfo {
    /** Returns current Net/USB related Input ID*/
    input: McInputId;
    /** Reserved */
    play_queue_type: string;
    /**  Returns playback status
     Values: "play" / "stop" / "pause" / "fast_reverse" / "fast_forward" */
    playback: "play" | "stop" | "pause" | "fast_reverse" | "fast_forward";
    /**  Returns repeat setting status
     Value: "off" / "one" / "all" */
    repeat: string;
    /**  Returns shuffle setting status
     Values: "off" / "on" / "songs" / "albums" */
    shuffle: string;
    /** Returns current settable repeat setting (Available on after API version 1.19)
    Values: "off" / "one" / "all" */
    repeat_available: string[];
    /**  Returns current settable shuffle setting (Available on after API version 1.19)
     Values: "off" / "on" / "songs" / "albums" */
    shuffle_available: string[];
    /**   Returns current playback time (unit in second). Returns -60000 if playback time is invalid
      Value Range: -60000 (invalid) / -59999 ~ 59999 (valid) */
    play_time: number;
    /**  Returns total playback time (unit in second). Returns 0 if total time is not available or invalid
     Value Range: 0 ~ 59999 */
    total_time: number;
    /**   Returns artist name.
      Returns station name if the input is Net Radio / Pandora / radiko.
      Returns station name/artist name if the input is Napster (Radio).
      If Net Radio is airable.radio, "(location / language)" will be appended to the station name.
      Returns ad name if Pandora playbacks ad contents.
      If input is MC Link, returns master’s internal content info or Room
      Yamaha Extended Control API Specification (Basic)
      Copyright  2018 Yamaha Corporation, ALL rights reserved. Page 80 of 129
      Name if the master input is one of external sources
      Text information may be left in artist / album / track while playback is stopped. At this time, you can expect playback to start by sending a Play request, but another song different from the displayed song such as when playing the station may be played. Please also note that there is no guarantee that playback will resume certainly depending on the situation.*/
    artist: string;
    /**  Returns album name.
     Returns channel name if the input is SiriusXM.
     Returns subtitle name if the input is radiko.
     Returns company name if Pandora playbacks an ad.
     If input is MC Link, returns master’s internal content info or Input Name if the master input is one of external sources */
    album: string;
    /**  Returns track name.
     Returns song name if the input is Napster / SiriusXM / Pandora.
     Returns title name if the input is radiko.
     If input is MC Link, returns master’s internal content info or empty text if the master input is one of external sources */
    track: string;
    /** Returns a URL to retrieve album art data. Data is in jpg/png/bmp/ymf format.The path is given as relative address. If "xxx/yyy/zzz.jpg" is returned, the absolute path is expressed as http://{host}/xxx/yyy/zzz.jpg
    Note: ymf is original format encrypted by Yamaha AV encryption method. */
    albumart_url: string;
    /**    Returns ID to identify album art. If ID got changed, retry to get album art data via albumart_url
       Value Range: 0 ～ 9999 */
    albumart_id: number;
    /** Returns USB device type. Returns "unknown" if no USB is connected
    Values: "msc" / "ipod" / "unknown" */
    usb_devicetype: string;
    /**  Returns whether or not auto top has initiated. If it is true, display appropriate messages to the external application user interface depending on which input current one is. This flag is cleared (set back to false) with these conditions as follows;
     - Playback is initiated properly
     - /netusb/setPlayback is executed
     - type = play found in /netusb/setListControl is executed
     Target Input : Pandora / SiriusXM
     A MusicCast Device that detects non-operation time (by key operation on the Device or by remote control) will always return false flag in this data */
    auto_stopped: boolean;
    /** Returns playback attribute info. Attributes are expressed as OR of bit field as shown below;
    b[0] Playable
    b[1] Capable of Stop
    b[2] Capable of Pause
    Yamaha Extended Control API Specification (Basic)
    Copyright  2018 Yamaha Corporation, ALL rights reserved. Page 81 of 129
    b[3] Capable of Prev Skip
    b[4] Capable of Next Skip
    b[5] Capable of Fast Reverse
    b[6] Capable of Fast Forward
    b[7] Capable of Repeat
    b[8] Capable of Shuffle
    b[9] Feedback Available (Pandora)
    b[10] Thumbs-Up (Pandora)
    b[11] Thumbs-Down (Pandora)
    b[12] Video (USB)
    b[13] Capable of Bookmark/Favorite (Net Radio / TIDAL / Deezer)
    b[14] DMR Playback (Server)
    b[15] Station Playback (Napster)
    b[16] AD Playback (Pandora)
    b[17] Shared Station (Pandora)
    b[18] Capable of Add Track (Napster/Pandora/JUKE/Qobuz)
    b[19] Capable of Add Album (Napster / JUKE)
    b[20] Shuffle Station (Pandora)
    b[21] Capable of Add Channel (Pandora)
    b[22] Sample Playback (JUKE)
    b[23] MusicPlay Playback (Server)
    b[24] Capable of Link Distribution
    b[25] Capable of Add Playlist (Qobuz)
    b[26] Capable of add MusicCast Playlist
    b[27] Capable of Add to Playlist (TIDAL / Deezer)
    With Pandora, b[9] = 1 validates "thumbs_up" / "thumbs_down" / "mark_tired" of managePlay and "why_this_song" of getPlayDescription.
    b[21] = 1 validates "add_channel_track" / "add_channel_artist" */
    attribute: number;
}

/** Cd Playback information */
export interface McCdPlayInfo {
    /** Returns current CD device status
        Values: "open" / "close" / "ready" / "not_ready"*/
    device_status: "open" | "close" | "ready" | "not_ready";
    /** Returns playback status
        Values: "play" / "stop" / "pause" / "fast_reverse" / "fast_forward" */
    playback: "play" | "stop" | "pause" | "fast_reverse" | "fast_forward";
    /**  Returns repeat setting status
        Value: "off" / "one" / "all" / "folder" / "a-b" */
    repeat: string;
    /**  Returns shuffle setting status
        Values: "off" / "on" / "folder" / "program" */
    shuffle: string;
    /** Returns current settable repeat setting (Available on after API version 1.19)
        Values: off" / "one" / "all" / "folder" */
    repeat_available: string[];
    /**  Returns current settable shuffle setting (Available on after API version 1.19)
        Values: "off" / "on" / "folder" */
    shuffle_available: string[];
    /** Returns current playback time (unit in second).
        Value Range: -59999 ~ 59999  */
    play_time: number;
    /** Returns current track total playback time (unit in second).
        Value Range: 0 ~ 59999 */
    total_time: number;
    /** Returns CD total playback time (unit in second).
        Value Range: 0 ~ 59999 */
    disc_time: number;
    /** Returns track number that is currently in playback. If no track, or playback status is complete stop, returns -1.
        Values: 0 ~ 512 */
    track_number: number;
    /** Returns total track number
        Values: 0 ~ 512 */
    total_tracks: number;
    /**   Returns artist name. */
    artist: string;
    /**  Returns album name. */
    album: string;
    /**  Returns track name. */
    track: string;
    /** Returns a URL to retrieve album art data. Data is in jpg/png/bmp/ymf format.The path is given as relative address. If "xxx/yyy/zzz.jpg" is returned, the absolute path is expressed as http://{host}/xxx/yyy/zzz.jpg
    Note: ymf is original format encrypted by Yamaha AV encryption method. */
}

/** Playback information of Tuner */
export interface McTunerPlayInfo {
    /** Returns current BandF
    Values: "am" / "fm" / "dab */
    band: "am" | "fm" | "dab";
    /** Returns Auto Scan (Up or Down) status */
    auto_scan: string;
    /**     Returns Auto Preset execution status */
    auto_preset: boolean;
    /**     Returns AM related information */
    am: {
        /**    Returns current preset number. 0 when there’s no presets
           Values: 0 (no presets), or one in the range gotten via /system/getFeatures */
        preset: number;
        /**     Returns frequency (unit in kHz) */
        freq: number;
        /**  Returns Tuned status */
        tuned: boolean;
    };
    /** Returns FM related information */
    fm: {
        /**  Returns current preset number. 0 when there’s no presets
         Values: 0 (no presets), or one in the range gotten via /system/getFeatures */
        preset: number;
        /**  Returns frequency (unit in kHz). */
        freq: number;
        /**  Returns Tuned status */
        tuned: boolean;
        /** Returns Audio Mode
        Values: "mono" / "stereo" */
        audio_mode: string;
    };
    /**   Returns RDS information. Available only when RDS is valid */
    rds: {
        /**   Returns Program Type */
        program_type: string;
        /** Returns Program Service */
        program_service: string;
        /**  Returns Radio Text A */
        radio_text_a: string;
        /**  Returns Radio Text B */
        radio_text_b: string;

    };
    /**  Returns DAB related information. Available only when DAB is valid */
    dab: {
        /** Returns current preset number. 0 when current station is not in presets
        Values: 0 (no presets), or one in the range gotten via /system/getFeatures */
        preset: number;
        /**   Returns Station ID */
        id: number;
        /**   Returns DAB status. When it’s in Tune Aid, valid parameters are "tune_aid" and "CH Label" only
          Values: "not_ready" / "initial_scan" / "tune_aid" / "ready" */
        status: string;
        /**   Returns DAB frequency (unit in kHz)
          Value Range: 174000 - 240000 */
        freq: number;
        /**   Returns Category
          Values: "primary" / "secondary" */
        category: string;
        /**   Returns Audio Mode
          Values: "mono" / "stereo" */
        audio_mode: string;
        /**  Returns audio bitrate (unit in kbps)
         Value Range: 32 ~ 256 */
        bit_rate: number;
        /**   Returns signal quality level
          Value Range: 0 - 100 */
        quality: number;
        /**  Returns signal strength level
         Value Range: 0 - 100 */
        tune_aid: number;
        /**  Returns Off Air status */
        off_air: boolean;
        /**  Returns DAB+ status */
        dab_plus: boolean;
        /**  Returns Program Type */
        program_type: string;
        /**    Returns CH Label */
        ch_label: string;
        /**   Returns Service Label */
        service_label: string;
        /**  Returns DLS */
        dls: string;
        /**  Returns Ensemble Label */
        ensemble_label: string;
        /**  Returns Initial Scan progress status. Available only when "dab_initial_scan" exists in tuner - func_list under /system/getFeatures
         Value Range: 0 - 100 */
        initial_scan_progress: number;
        /** Returns station numbers detected by Initial Scan. Available only when "dab_initial_scan" exists in tuner - func_list under /system/getFeatures
        0 if Initial Scan hasn’t executed or nothing found
        Value Range: 0 - 255 */
        total_station_num: number;
    };
    /** Reserved */
    hd_radio: any;
}

export interface McDistributionInfo {
    /** Returns Group ID in 32-digit hex */
    group_id: string;
    /** Return Group Name */
    group_name: string;
    /** Returns a role of Link distribution Values: "server", "client, "none" */
    role: McGroupRole;
    /**  Returns a construction state of distribution system
     * Valid only when role is Server. (Valid for API Version 2.00 or later)
     * Values: "building" / "working" / "deleting"*/
    status: string;
    /** Returns target Zone ID that can work as a client of distributing server. If there’s no parameter of this, “main” is implicitly chosen.
     * Values: "main" / "zone2" / "zone3" / "zone4" */
    server_zone: McZoneId;
    /** Returns registered client IP address list
     * Valid only when the role is "server" */
    client_list?: McLinkedClient[];
    /** Returns information on whether distribution construction is prohibited or not
     * If there is no parameter, please handle as it is not in the construction prohibited state */
    build_disable: any[]
    /**  Returns whether sound interruption was detected during distribution
     * This value is cleared when CONNECT is executed or Network Module is reset
     * Even when distribution is canceled, this value is not cleared*/
    audio_dropout: boolean;
}

export interface McStereoPairInfo {
    /** Returns Stereo Pair status
        Values : "none" / "master_left" / "master_right" / "slave_left" / "slave_right" */
    status: string;
    /** Returns the other side device (Stereo Pair) information */
    pair_info: {
        /** Returns whether or not the other side device is alive */
        alive: string;
        /** Returns IP Address */
        ip_address: string;
        /** Returns MAC Address (Wireless Direct 12 digit ASCII) */
        mac_address: string;
    }

}

export interface McLinkedClient {
    /** Returns clients’ IP Address */
    ip_address: string;
    /** Returns a type of distributed data 
     * Values: "base" / "ext" */
    data_type: string;
}


export interface McNameText {
    /** Returns a list of Zone */
    zone_list: {
        /** Returns Zone ID */
        id: McZoneId;
        /** Returns text information related to Zone ID */
        text: string;
    }[];
    /** Returns a list of Input */
    input_list: {
        /** Returns Input ID */
        id: McInputId;
        /** Returns text information related to Input ID */
        text: string;
    }[];
    /** Returns a list of Sound program */
    sound_program_list: {
        /** Returns Sound Program ID */
        id: McSoundProgram;
        /** Returns text information related to Sound Program ID */
        text: string;
    }[];
}

export interface McEvent {
    /** Returns System related information */
    system?: {
        /** Returns whether or not Bluetooth info has changed. If so, pull renewed info using /system/getBluetoothInfo */
        bluetooth_info_updated?: boolean;
        /** Returns whether or not Bluetooth(sink) device list has changed.If so, pull renewed info using /system/getBluetoothDeviceList */
        bluetooth_device_list_updated?: boolean;
        /** Returns whether or not System overall info has changed.If so, pull renewed info using /system/getFuncStatus */
        func_status_updated?: boolean;
        /** Reserved */
        speaker_settings_updated?: boolean;
        /** Returns whether or not name text info has changed.If so, pull renewed info using /system/getNameText. */
        name_text_updated?: boolean;
        /** Reserved */
        tag_updated?: boolean;
        /** Returns whether or not Location info has changed.If so, pull renewed info using /system/getLocationInfo */
        location_info_updated?: boolean;
        /** Reserved */
        stereo_pair_info_updated?: boolean;
    };
    /** Returns Main Zone related information */
    main?: McZoneEvent;
    /** Returns information related to Zone2. */
    zone2?: McZoneEvent;
    /** Returns information related to Zone3. */
    zone3?: McZoneEvent;
    /** Returns information related to Zone4. */
    zone4?: McZoneEvent;
    /** Returns Tuner related information */
    tuner?: {
        /** Returns whether or not playback info has changed.If so, pull renewed info using /tuner/getPlayInfo */
        play_info_updated?: boolean;
        /** Returns whether or not preset info has changed.If so, pull renewed info using /tuner/getPresetInfo */
        preset_info_updated?: boolean;
    };
    /** Returns Net / USB related information */
    netusb?: {
        /** Returns error codes happened during playback for displaying appropriate messages to the external application user interface.If multiple errors happen at the same time, refer to the value of multiple_play_errors sent together for proper messaging
    Values:
    0: No Error
    1: Access Error(common for all Net / USB sources)
    2: Playback Unavailable(common for all Net / USB sources)
    3: Skip Limit Reached(Napster / Pandora)
    4: Invalid Session(Napster / SiriusXM)
    5: High - Resolution File Not Playable at MusicCast Leaf(Server)
    6: User Uncredentialed(Qobuz)
    7: Track Restricted by Right Holders(Qobuz)
    8: Sample Restricted by Right Holders(Qobuz)
    9: Genre Restricted by Streaming Credentials(Qobuz)
    10: Application Restricted by Streaming Credentials(Qobuz)
    11: Intent Restricted by Streaming Credentials(Qobuz)
    100: Multiple Errors(common for all Net / USB sources) */
        play_error?: number;
        /** Returns bit field flags of multiple playback errors.Flags are expressed as OR of bit field.
            play_error code x is stored as a flag in b[x] shown below.x = 0 is reserved for it is for No Error, and x = 100 is ignored here
            b[0] reserved(for it’s No Error)
            b[1] Access Error(common for all Net / USB sources)
            ...
            b[11] Intent Restricted by Streaming Credentials(Qobuz) */
        multiple_play_errors?: number;
        /** Returns playback related message.Max size is 256 bytes */
        play_message?: string;
        /** Returns whether or not account info has changed.If so, pull renewed info using /netusb/getAccountStatus */
        account_updated?: boolean;
        /** Returns current playback time(unit in second) 
          * Value: rages - 59999 - 59999
          */
        play_time?: number;
        /** Returns whether or not preset info has changed.If so, pull renewed info using /netusb/getPresetInfo */
        preset_info_updated?: boolean;
        /** Returns whether or not playback history info has changed.If so, pull renewed info using /netusb/getRecentInfo */
        recent_info_updated?: boolean;
        /** Returns results of Preset operations */
        preset_control?: {
            /** Returns a type of Preset operations
                * Values: "store" / "clear" / "recall" */
            type?: "store" | "clear" | "recall";
            /** Returns a Preset number being operated
              * Value: one in the range gotten via /system/getFeatures */
            num?: number;
            /** Returns the result of operation
              * Values: "success"(for all types) / "error" (for all types) / "empty"(only for recall) / "not_found" (only for recall) */
            result?: "sucess" | "error" | "empty" | "not_found";
        };
        /** Returns trial status of a Device */
        trial_status?: {
            /** Returns Input IDs related to Net / USB */
            input: string;
            /** Returns whether or not trial can be initiated.If false, new trial cannot get started due to a Device in trial status */
            enable: boolean;
        };
        /** Returns remaining time of a trial */
        trial_time_left?: {
            /** Returns Net / USB related Input IDs */
            input?: string;
            /** Returns remaining days of trial. 0 means it expires within 24 hours. - 1 means it has expired, -2 means no info is retrieved yet from the server */
            time?: number;
        };
        /** Returns whether or not playback info has changed.If so, pull renewed info using /netusb/getPlayInfo */
        play_info_updated?: boolean;
        /** Returns whether or not list info has changed.If so, pull renewed info using /netusb/getListInfo */
        list_info_updated?: boolean;
    };
    /** Returns CD related information */
    cd?: {
        /** Returns CD device status
          * Values: "open" / "close" / "ready" / "not_ready" */
        device_status?: "open" | "close" | "ready" | "not_ready";
        /** Returns current playback time(unit in second). 
         * Value Range: -59999 ~59999
        */
        play_time?: number;
        /** Returns whether or not playback info has changed.If so, pull renewed info using /cd/getPlayInfo */
        play_info_updated?: boolean;
    };
    /** Returns Link distribution related information */
    dist?: {
        /** Returns whether or not Link distribution Device info has changed.If so, pull renewed info using /dist/getDistributionInfo */
        dist_info_updated?: boolean;
    };
    /** Returns Clock related information */
    clock?: {
        /** Returns whether or not clock info has changed.If so, pull renewed info using /clock/getSettings */
        settings_updated?: boolean;
    };
    /** Return s Device ID.ID is same value using /system/getDeviceInfo 
     * Available on and after API Version 1.17, the Device ID is always included in the notification data. */
    device_id: string;
}


export interface McZoneEvent {
    /** Returns power status
        Values: "on" / "standby" */
    power?: "on" | "standby";
    /** Returns current Input ID 
        Values: Input IDs gotten via /system/getFeature
    */
    input?: McInputId;
    /** Returns volume value
        Values: Value range calculated by minimum / maximum / step values gotten via /system/getFeatures */
    volume?: number;
    /** Returns mute status */
    mute?: boolean;
    /** Returns whether or not other info has changed than main zone power / input / volume / mute status.If so, pull renewed info using /main/getStatus */
    status_updated?: boolean;
    /** Returns whether or not signal info has changed.If so, pull renewed info using /main/getSignalInfo */
    signal_info_updated?: boolean;
}

export enum McGroupRole {
    Server = "server",
    Client = "client",
    None = "none"
}

export enum McZoneId {
    Main = "main",
    Zone2 = "zone2",
    Zone3 = "zone3",
    Zone4 = "zone4"
}


export enum McInputId {
    CD = "cd",
    TUNER = "tuner",
    MULTI_CH = "multi_ch",
    PHONO = "phono",
    HDMI1 = "hdmi1",
    HDMI2 = "hdmi2",
    HDMI3 = "hdmi3",
    HDMI4 = "hdmi4",
    HDMI5 = "hdmi5",
    HDMI6 = "hdmi6",
    HDMI7 = "hdmi7",
    HDMI8 = "hdmi8",
    HDMI = "hdmi",
    AV1 = "av1",
    AV2 = "av2",
    AV3 = "av3",
    AV4 = "av4",
    AV5 = "av5",
    AV6 = "av6",
    AV7 = "av7",
    V_AUX = "v_aux",
    AUX1 = "aux1",
    AUX2 = "aux2",
    AUX = "aux",
    AUDIO1 = "audio1",
    AUDIO2 = "audio2",
    AUDIO3 = "audio3",
    AUDIO4 = "audio4",
    AUDIO_CD = "audio_cd",
    AUDIO = "audio",
    OPTICAL1 = "optical1",
    OPTICAL2 = "optical2",
    OPTICAL = "optical",
    COAXIAL1 = "coaxial1",
    COAXIAL2 = "coaxial2",
    COAXIAL = "coaxial",
    DIGITAL1 = "digital1",
    DIGITAL2 = "digital2",
    DIGITAL = "digital",
    LINE1 = "line1",
    LINE2 = "line2",
    LINE3 = "line3",
    LINE_CD = "line_cd",
    ANALOG = "analog",
    TV = "tv",
    BD_DVD = "bd_dvd",
    USB_DAC = "usb_dac",
    USB = "usb",
    BLUETOOTH = "bluetooth",
    SERVER = "server",
    NET_RADIO = "net_radio",
    RHAPSODY = "rhapsody",
    NAPSTER = "napster",
    PANDORA = "pandora",
    SIRIUSXM = "siriusxm",
    SPOTIFY = "spotify",
    JUKE = "juke",
    AIRPLAY = "airplay",
    RADIKO = "radiko",
    QOBUZ = "qobuz",
    MC_LINK = "mc_link",
    MAIN_SYNC = "main_sync",
    NONE = "none"
}

export enum McSoundProgram {
    MUNICH_A = "munich_a",
    MUNICH_B = "munich_b",
    MUNICH = "munich",
    FRANKFURT = "frankfurt",
    STUTTGART = "stuttgart",
    VIENNA = "vienna",
    AMSTERDAM = "amsterdam", USA_A = "usa_a",
    USA_B = "usa_b",
    TOKYO = "tokyo",
    FREIBURG = "freiburg",
    ROYAUMONT = "royaumont",
    CHAMBER = "chamber",
    CONCERT = "concert",
    VILLAGE_GATE = "village_gate",
    VILLAGE_VANGUARD = "village_vanguard",
    WAREHOUSE_LOFT = "warehouse_loft",
    CELLAR_CLUB = "cellar_club",
    JAZZ_CLUB = "jazz_club",
    ROXY_THEATRE = "roxy_theatre",
    BOTTOM_LINE = "bottom_line",
    ARENA = "arena", SPORTS = "sports",
    ACTION_GAME = "action_game",
    ROLEPLAYING_GAME = "roleplaying_game",
    GAME = "game",
    MUSIC_VIDEO = "music_video",
    MUSIC = "music",
    RECITAL_OPERA = "recital_opera",
    PAVILION = "pavilion",
    DISCO = "disco",
    STANDARD = "standard",
    SPECTACLE = "spectacle",
    SCIFI = "sci-fi",
    ADVENTURE = "adventure",
    DRAMA = "drama",
    TALK_SHOW = "talk_show",
    TV_PROGRAM = "tv_program",
    MONO_MOVIE = "mono_movie",
    MOVIE = "movie",
    ENHANCED = "enhanced",
    STEREO_2CH = "2ch_stereo",
    STEREO_5CH = "5ch_stereo",
    STEREO_7CH = "7ch_stereo",
    STEREO_9CH = "9ch_stereo",
    STEREO_11CH = "11ch_stereo",
    STEREO = "stereo",
    SURR_DECODER = "surr_decoder",
    MY_SURROUND = "my_surround",
    TARGET = "target",
    STRAIGHT = "straight",
    OFF = "off",
    BASS_BOOSTER = "bass_booster",
}

export enum McDeviceFunctions {
    WIRED_LAN = "wired_lan",
    WIRELESS_LAN = "wireless_lan",
    WIRELESS_DIRECT = "wireless_direct",
    EXTEND_1_BAND = "extend_1_band",
    DFS_OPTION = "dfs_option",
    NETWORK_STANDBY = "network_standby",
    NETWORK_STANDBY_AUTO = "network_standby_auto",
    BLUETOOTH_STANDBY = "bluetooth_standby",
    BLUETOOTH_TX_SETTING = "bluetooth_tx_setting",
    AUTO_POWER_STANDBY = "auto_power_standby",
    IR_SENSOR = "ir_sensor",
    SPEAKER_A = "speaker_a",
    SPEAKER_B = "speaker_b",
    HEADPHONE = "headphone",
    DIMMER = "dimmer",
    ZONE_B_VOLUME_SYNC = "zone_b_volume_sync",
    HDMI_OUT_1 = "hdmi_out_1",
    HDMI_OUT_2 = "hdmi_out_2",
    HDMI_OUT_3 = "hdmi_out_3",
    AIRPLAY = "airplay",
    STEREO_PAIR = "stereo_pair",
    SPEAKER_SETTINGS = "speaker_settings",
    DISKLAVIER_SETTINGS = "disklavier_settings",
    BACKGROUND_DOWNLOAD = "background_download",
    REMOTE_INFO = "remote_info",
    NETWORK_REBOOT = "network_reboot",
    SYSTEM_REBOOT = "system_reboot",
    AUTO_PLAY = "auto_play",
    SPEAKER_PATTERN = "speaker_pattern",
    PARTY_MODE = "party_mode"
}

export enum McResponseCode {
    SuccessfulRequest = 0,
    Initializing = 1,
    InternalError = 2,
    InvalidRequest = 3,
    InvalidParameter = 4,
    Guarded = 5
}

