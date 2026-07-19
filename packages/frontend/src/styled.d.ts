import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colorPrimary: string;
    colorPrimaryHover?: string;
    borderRadius: number;
    colorBorderSecondary: string;
    colorBorder: string;
    colorBgBase: string;
    colorBgContainer: string;
    colorBgLayout: string;
    colorText: string;
    colorTextBase: string;
    colorTextSecondary: string;
    colorTextTertiary?: string;
    colorTextDescription?: string;
    colorSuccess?: string;
    colorError?: string;
    colorBgTextHover?: string;
    fontFamily?: string;
  }
}
