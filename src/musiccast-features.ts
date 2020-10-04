export interface McFeatures {
    zone_num: number; // Returns Zone numbers. Zone B is treated as Zone2 in YXC so a Device with ZoneB returns 2. A Device without Zones returns 1
    input_list: [McInput];
    range_step: McRangeStep;
    zone: [McZone];
}

export interface McInput {
    id: McInputId;
    /** Returns whether an input can be a source of Link distribution */
    distribution_enable: boolean,
    /** Returns whether an input can be renamed */
    rename_enable: boolean,
    /** Return whether an input comes with an account info*/
    account_enable: boolean,
    /** Returns a type of playback info. Depending on this type, use specific API to retrieve appropriate playback info Values: "none" / "tuner" / "netusb" / "cd" */
    play_info_type: string
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

export interface McZone {
    id: McZoneId;
    /** Returns whether the target Zone is Zone B or not. Valid only when Zone ID is "zone2" */
    zone_b: boolean;
    /** Returns a list of valid functions
    Values: "power" / "sleep" / "volume" / "mute" / "sound_program" /
    "direct" / "pure_direct" / "enhancer" / "tone_control" / "equalizer" /
    "balance" / "dialogue_level" / "dialogue_lift" / "clear_voice" /
    "subwoofer_volume" / "bass_extension" / "signal_info" /
    "prepare_input_change" / "link_control" / "link_audio_delay" */
    func_list: [string];
    /** Returns a list of selectable Input IDs */
    input_list: [McInputId];
    /** Returns a list of selectable Sound Program IDs */
    sound_program_list: [McSoundProgram];
    /** Returns selectable settings of Tone Control Mode. If there’s no list
    of this, it’s fixed to "manual"
    Values: "manual" / "auto" / "bypass" */
    tone_controle_mode_list?: [string];
    /** Returns selectable settings of Equalizer Mode. If there’s not list of
    this, it’s fixed to “manual”
    Values: "manual" / "auto" / "bypass" */
    equalizer_mode_list?: [string];
    /** Returns selectable settings of Link Control
    Values: "standard" / "stability" / "speed" */
    link_control_list: [string];
    /**Returns selectable settings of Link Audio Delay
    Values: "lip_sync"/"audio_sync" / "audio_sync_on" / "audio_sync_off" */
    link_audio_delay_list: [string];
    range_step: [McRangeStep];
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
    client_list?: [McLinkedClient]
    /** Returns information on whether distribution construction is prohibited or not
     * If there is no parameter, please handle as it is not in the construction prohibited state */
    build_disable: [any]
    /**  Returns whether sound interruption was detected during distribution
     * This value is cleared when CONNECT is executed or Network Module is reset
     * Even when distribution is canceled, this value is not cleared*/
    audio_dropout: boolean;
}

export interface McStereoPairInfo {
    status: string;
    pair_info: {
        alive: string,
        ip_address: string,
        mac_address: string
    }

}

export interface McLinkedClient {
    /** Returns clients’ IP Address */
    ip_address: string;
    /** Returns a type of distributed data 
     * Values: "base" / "ext" */
    data_type: string;
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

export enum McResponseCode {
    SuccessfulRequest = 0,
    Initializing = 1,
    InternalError = 2,
    InvalidRequest = 3,
    InvalidParameter = 4,
    Guarded = 5
}

