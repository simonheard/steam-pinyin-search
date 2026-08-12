import { DialogBodyText, IconsModule, definePlugin } from '@steambrew/client';

export default definePlugin(() => {
  console.info('[SteamPinyinSearch] plugin loaded');
  return {
    title: 'Steam Pinyin Search',
    icon: <IconsModule.Search />,
    content: <DialogBodyText>Steam Pinyin Search is loaded.</DialogBodyText>,
    onDismount() {
      console.info('[SteamPinyinSearch] plugin unloaded');
    },
  };
});
