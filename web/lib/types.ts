export type Variant={label:string;architecture:string;android:string;dpi:string;format:string;download:string};

export type App={
  name:string;
  packageName:string;
  version:string;
  source:string;
  category:string[];
  variants:Variant[];
  sourcePage:string;
  playUrl?:string;
  icon:string;
  download?:string;
  size?:number;
  md5?:string;
  rank?:string;
  store?:string;
  signer?:string;
};

export type Version={
  version:string;
  size:number;
  md5:string;
  date:string;
  src:string;
  download?:string;
  page?:string;
};

export type AppDetail={
  pkg:string;
  name:string;
  icon:string;
  version:string;
  size:number;
  md5:string;
  signer:string;
  rank:string;
  store:string;
  download?:string;
  description:string;
  changelog:string;
  screenshots:string[];
  category:string;
  developer:string;
  rating:number;
  downloads:string;
  updated:string;
  sourcePage:string;
  playUrl?:string;
  store2?:string;
};

export type Suggest={name:string;packageName:string;icon:string;version:string};

export type BrowseItem={name:string;packageName:string;icon:string;sourcePage:string;rating?:string;downloads?:string};

export type ResolveMap=Record<string,{download:string;size:number;md5:string;version:string;signer:string;rank:string;store:string}>;
