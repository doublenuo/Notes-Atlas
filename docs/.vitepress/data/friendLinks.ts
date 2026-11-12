export interface FriendLink {
  /** 站点名称 */
  name: string
  /** 一句话描述，建议 12–24 个字 */
  desc: string
  /** 站点地址，必须带 https:// 或 http:// */
  link: string
  /** 头像：支持 /public 下的本地路径，也支持完整外链；留空则显示首字头像 */
  avatar?: string
}

export const FRIEND_LINKS: FriendLink[] = [
  {
    name: "Weno's Blog",
    desc: "记录学习、研究与生活的个人知识库",
    link: "https://blogs.lovetulin.cn",
    avatar: "https://blogs.lovetulin.cn/tx.jpg",
  },
]
