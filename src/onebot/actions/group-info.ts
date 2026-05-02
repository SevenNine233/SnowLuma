import type { ApiHandler, ApiActionContext } from '../api-handler';
import { asNumber, asBoolean } from '../api-handler';
import { RETCODE, failedResponse, okResponse } from '../types';

export function register(h: ApiHandler, ctx: ApiActionContext): void {
  h.registerAction('get_group_list', async (params) => {
    const noCache = asBoolean(params.no_cache, false);
    if (ctx.getGroupList) {
      return okResponse(await ctx.getGroupList(noCache));
    }
    return okResponse([]);
  });

  h.registerAction('get_group_info', async (params) => {
    const groupId = asNumber(params.group_id);
    if (!groupId) return failedResponse(RETCODE.BAD_REQUEST, 'group_id is required');
    const noCache = asBoolean(params.no_cache, false);
    if (ctx.getGroupInfo) {
      const info = await ctx.getGroupInfo(groupId, noCache);
      return okResponse(info ?? { group_id: groupId, group_name: '', member_count: 0, max_member_count: 0 });
    }
    return okResponse({ group_id: groupId, group_name: '', member_count: 0, max_member_count: 0 });
  });

  h.registerAction('get_group_member_list', async (params) => {
    const groupId = asNumber(params.group_id);
    if (!groupId) return failedResponse(RETCODE.BAD_REQUEST, 'group_id is required');
    const noCache = asBoolean(params.no_cache, false);
    if (ctx.getGroupMemberList) {
      return okResponse(await ctx.getGroupMemberList(groupId, noCache));
    }
    return okResponse([]);
  });

  h.registerAction('get_group_member_info', async (params) => {
    const groupId = asNumber(params.group_id);
    const userId = asNumber(params.user_id);
    if (!groupId || !userId) return failedResponse(RETCODE.BAD_REQUEST, 'group_id and user_id are required');
    const noCache = asBoolean(params.no_cache, false);
    if (ctx.getGroupMemberInfo) {
      const info = await ctx.getGroupMemberInfo(groupId, userId, noCache);
      return okResponse(info ?? {
        group_id: groupId, user_id: userId, nickname: '', card: '',
        sex: 'unknown', age: 0, join_time: 0, last_sent_time: 0,
        level: '0', role: 'member', title: '',
      });
    }
    return okResponse({
      group_id: groupId, user_id: userId, nickname: '', card: '',
      sex: 'unknown', age: 0, join_time: 0, last_sent_time: 0,
      level: '0', role: 'member', title: '',
    });
  });

  h.registerAction('get_group_honor_info', async (params) => {
    const groupId = asNumber(params.group_id);
    if (!groupId) return failedResponse(RETCODE.BAD_REQUEST, 'group_id is required');
    return okResponse({
      group_id: groupId, current_talkative: null, talkative_list: [],
      performer_list: [], legend_list: [], strong_newbie_list: [], emotion_list: [],
    });
  });

  h.registerAction('get_group_system_msg', async () => {
    if (ctx.handleGetGroupSystemMsg) {
      return okResponse(await ctx.handleGetGroupSystemMsg());
    }
    return okResponse([]);
  });
}
