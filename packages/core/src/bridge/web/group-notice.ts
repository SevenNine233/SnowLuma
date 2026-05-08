import { RequestUtil, cookieToString, getBknFromCookie } from './request-util';

export interface SetNoticeRetSuccess {
    ec?: number;
    em?: string;
    [key: string]: any;
}


/**
 * 发送群公告 Web API
 */
export async function setGroupNoticeWebAPI(
    cookieObject: Record<string, string>,
    groupCode: string,
    content: string,
    pinned: number = 0,
    type: number = 1,
    isShowEditCard: number = 1,
    tipWindowType: number = 1,
    confirmRequired: number = 1,
    picId: string = '',
    imgWidth: number = 540,
    imgHeight: number = 300
): Promise<SetNoticeRetSuccess | undefined> {
    try {
        const settings = JSON.stringify({
            is_show_edit_card: isShowEditCard,
            tip_window_type: tipWindowType,
            confirm_required: confirmRequired,
        });

        const externalParam = {
            pic: picId,
            imgWidth: imgWidth.toString(),
            imgHeight: imgHeight.toString(),
        };

        const url = `https://web.qun.qq.com/cgi-bin/announce/add_qun_notice?${new URLSearchParams({
            bkn: getBknFromCookie(cookieObject),
            qid: groupCode,
            text: content,
            pinned: pinned.toString(),
            type: type.toString(),
            settings,
            ...(picId === '' ? {} : externalParam),
        }).toString()}`;

        const ret = await RequestUtil.HttpGetJson<SetNoticeRetSuccess>(
            url,
            'POST', // 注意这里必须是 POST
            '',
            { Cookie: cookieToString(cookieObject) }
        );
        return ret;
    } catch (e) {
        return undefined;
    }
}