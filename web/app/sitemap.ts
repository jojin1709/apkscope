import type {MetadataRoute} from 'next';

const SITE='https://apkscope.vercel.app';

const POPULAR=[
  'com.whatsapp','com.instagram.android','org.telegram.messenger','com.facebook.katana',
  'com.zhiliaoapp.musically','com.spotify.music','com.netflix.mediaclient','com.mojang.minecraftpe',
  'com.snapchat.android','com.android.chrome','com.google.android.gm','com.viber.android',
  'org.thoughtcrime.securesms','com.reddit.frontpage','com.discord','org.fdroid.fdroid',
  'com.microsoft.office.outlook','com.google.android.youtube','com.slack','com.whatsapp.w4b'
];

export default function sitemap():MetadataRoute.Sitemap{
  const base:MetadataRoute.Sitemap=[
    {url:SITE,lastModified:new Date(),changeFrequency:'daily',priority:1},
    {url:`${SITE}/#sources`,lastModified:new Date(),changeFrequency:'weekly',priority:0.6},
    {url:`${SITE}/#tools`,lastModified:new Date(),changeFrequency:'weekly',priority:0.6}
  ];
  const apps=POPULAR.filter(p=>/^[a-zA-Z]\w*(\.\w+)+$/.test(p)).map(p=>({
    url:`${SITE}/app/${p}`,
    lastModified:new Date(),
    changeFrequency:'weekly' as const,
    priority:0.8
  }));
  return[...base,...apps];
}
