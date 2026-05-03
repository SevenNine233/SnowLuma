// QQ info store — per-UIN state for friends, groups, member lookup.
// Port of src/bridge/include/bridge/qq_info.h + src/bridge/src/qq_info.cpp

export interface UserProfileInfo {
  uin: number;
  uid: string;
  nickname: string;
  remark: string;
  qid: string;
  sex: string;
  age: number;
  sign: string;
  avatar: string;
}

export interface FriendInfo {
  uin: number;
  uid: string;
  nickname: string;
  remark: string;
}

export interface GroupMemberInfo {
  uin: number;
  uid: string;
  nickname: string;
  card: string;
  role: string;       // 'owner' | 'admin' | 'member'
  level: number;
  title: string;
  joinTime: number;
  lastSentTime: number;
  shutUpTime: number;
}

export interface QQGroupInfo {
  groupId: number;
  groupName: string;
  remark: string;
  memberCount: number;
  memberMax: number;
  members: Map<number, GroupMemberInfo>;
}

export interface GroupRequestInfo {
  groupId: number;
  groupName: string;
  targetUid: string;
  targetUin: number;
  targetName: string;
  invitorUid: string;
  invitorUin: number;
  invitorName: string;
  operatorUid: string;
  operatorUin: number;
  operatorName: string;
  sequence: number;
  state: number;
  eventType: number;
  comment: string;
  filtered: boolean;
}

export class QQInfo {
  private uin_: string;
  private nickname_ = '';
  private selfProfile_: UserProfileInfo | null = null;
  private userProfiles_ = new Map<number, UserProfileInfo>();
  private friends_: FriendInfo[] = [];
  private groups_ = new Map<number, QQGroupInfo>();

  constructor(uin: string) {
    this.uin_ = uin;
  }

  get uin(): string { return this.uin_; }

  get nickname(): string { return this.nickname_; }
  set nickname(v: string) { this.nickname_ = v; }

  // --- Self profile ---

  setSelfProfile(info: UserProfileInfo): void { this.selfProfile_ = info; }
  get selfProfile(): UserProfileInfo | null { return this.selfProfile_; }
  get selfUid(): string | null { return this.selfProfile_?.uid ?? null; }

  // --- User profiles ---

  setUserProfile(info: UserProfileInfo): void {
    this.userProfiles_.set(info.uin, info);
  }

  findUserProfile(uin: number): UserProfileInfo | null {
    return this.userProfiles_.get(uin) ?? null;
  }

  // --- Friends ---

  setFriends(friends: FriendInfo[]): void { this.friends_ = friends; }
  get friends(): FriendInfo[] { return this.friends_; }

  findFriend(uin: number): FriendInfo | null {
    return this.friends_.find(f => f.uin === uin) ?? null;
  }

  // --- Groups ---

  setGroups(groups: QQGroupInfo[]): void {
    this.groups_.clear();
    for (const g of groups) {
      this.groups_.set(g.groupId, g);
    }
  }

  get groups(): QQGroupInfo[] { return [...this.groups_.values()]; }

  findGroup(groupId: number): QQGroupInfo | null {
    return this.groups_.get(groupId) ?? null;
  }

  findGroupMember(groupId: number, uin: number): GroupMemberInfo | null {
    return this.groups_.get(groupId)?.members.get(uin) ?? null;
  }

  setGroupMembers(groupId: number, members: GroupMemberInfo[]): void {
    const g = this.groups_.get(groupId);
    if (!g) return;
    g.members.clear();
    for (const m of members) {
      g.members.set(m.uin, m);
    }
  }

  updateGroupMember(groupId: number, member: GroupMemberInfo): void {
    const g = this.groups_.get(groupId);
    if (!g) return;
    g.members.set(member.uin, member);
  }

  // --- UID resolution ---

  resolveUid(uid: string): number | null {
    // Check self
    if (this.selfProfile_?.uid === uid) {
      return this.selfProfile_.uin || parseInt(this.uin_, 10) || null;
    }
    // Check friends
    for (const f of this.friends_) {
      if (f.uid === uid) return f.uin;
    }
    // Check user profiles
    for (const [, p] of this.userProfiles_) {
      if (p.uid === uid) return p.uin;
    }
    // Check all group members
    for (const [, g] of this.groups_) {
      for (const [, m] of g.members) {
        if (m.uid === uid) return m.uin;
      }
    }
    return null;
  }

  resolveGroupMemberUid(groupId: number, uid: string): number | null {
    const g = this.groups_.get(groupId);
    if (!g) return null;
    for (const [, m] of g.members) {
      if (m.uid === uid) return m.uin;
    }
    return null;
  }

  // --- Reverse UID lookup (UIN → UID) ---

  findUidByUin(uin: number): string | null {
    // Check self
    if (this.selfProfile_ && this.selfProfile_.uin === uin && this.selfProfile_.uid) {
      return this.selfProfile_.uid;
    }
    // Check friends
    for (const f of this.friends_) {
      if (f.uin === uin && f.uid) return f.uid;
    }
    // Check user profiles
    for (const [, p] of this.userProfiles_) {
      if (p.uin === uin && p.uid) return p.uid;
    }
    // Check all group members
    for (const [, g] of this.groups_) {
      for (const [, m] of g.members) {
        if (m.uin === uin && m.uid) return m.uid;
      }
    }
    return null;
  }

  findUidByUinInGroup(groupId: number, uin: number): string | null {
    const g = this.groups_.get(groupId);
    if (!g) return null;
    for (const [, m] of g.members) {
      if (m.uin === uin && m.uid) return m.uid;
    }
    return null;
  }
}
