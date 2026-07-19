import styled from 'styled-components';
import { FileText } from 'lucide-react';

export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: ${(props) => props.theme.colorBgLayout};
`;

export const StyledLayout = styled.div`
  height: 100vh;
  overflow: hidden;
  background: ${(props) => props.theme.colorBgLayout};
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (max-width: 768px) {
    height: auto;
    overflow: visible;
  }
`;

export const StyledHeader = styled.header`
  background: ${(props) =>
    props.theme.colorBgBase === '#09090b'
      ? 'rgba(24, 24, 27, 0.8)'
      : 'rgba(255, 255, 255, 0.8)'} !important;
  backdrop-filter: blur(12px);
  padding: 0 16px;
  border-bottom: 1px solid ${(props) => props.theme.colorBorderSecondary} !important;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  flex-shrink: 0;

  @media (min-width: 576px) {
    padding: 0 50px;
  }
`;

export const StyledContent = styled.div`
  padding: 16px;
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (min-width: 576px) {
    padding: 32px 50px;
  }

  @media (max-width: 768px) {
    overflow: visible;
    display: block;
    padding: 24px 16px;
  }

  &::before {
    content: '';
    position: absolute;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 400px;
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.08) 0%,
      rgba(99, 102, 241, 0) 70%
    );
    pointer-events: none;
    z-index: 0;
  }
`;

export const ContentWrapper = styled.div`
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    overflow: visible;
    display: block;
  }
`;

export const ViewTabs = styled.div`
  display: flex;
  gap: 16px;
  border-bottom: 1px solid ${(props) => props.theme.colorBorderSecondary};
  margin-bottom: 20px;
`;

export const TabButton = styled.button<{ $active: boolean }>`
  background: transparent;
  border: none;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: ${(props) =>
    props.$active
      ? props.theme.colorPrimary
      : props.theme.colorBgBase === '#09090b'
        ? '#94a3b8'
        : '#64748b'};
  border-bottom: 2px solid
    ${(props) => (props.$active ? props.theme.colorPrimary : 'transparent')};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -1px;

  &:hover {
    color: ${(props) => props.theme.colorPrimary};
  }
`;

export const StyledLogoIcon = styled(FileText)`
  font-size: 24px;
  color: ${(props) => props.theme.colorPrimary};
  width: 24px;
  height: 24px;
`;

export const StyledBrandTitle = styled.h4`
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 700;
  color: ${(props) => props.theme.colorTextBase};

  @media (min-width: 576px) {
    font-size: 20px !important;
  }
`;

export const StyledTag = styled.span<{ color?: string }>`
  border-radius: 20px;
  padding: 2px 10px;
  font-weight: 600;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.02em;

  background: ${(props) => {
    if (props.color === 'success') return 'rgba(16, 185, 129, 0.1)';
    if (props.color === 'error' || props.color === 'red')
      return 'rgba(239, 68, 68, 0.1)';
    if (props.color === 'warning' || props.color === 'orange')
      return 'rgba(245, 158, 11, 0.1)';
    return props.theme.colorBgBase === '#09090b'
      ? 'rgba(99, 102, 241, 0.15)'
      : '#e0e7ff';
  }};
  color: ${(props) => {
    if (props.color === 'success') return '#10b981';
    if (props.color === 'error' || props.color === 'red') return '#ef4444';
    if (props.color === 'warning' || props.color === 'orange') return '#f59e0b';
    return props.theme.colorBgBase === '#09090b' ? '#a5b4fc' : '#4f46e5';
  }};
  border: 1px solid
    ${(props) => {
      if (props.color === 'success') return 'rgba(16, 185, 129, 0.2)';
      if (props.color === 'error' || props.color === 'red')
        return 'rgba(239, 68, 68, 0.2)';
      if (props.color === 'warning' || props.color === 'orange')
        return 'rgba(245, 158, 11, 0.2)';
      return props.theme.colorBgBase === '#09090b'
        ? 'rgba(99, 102, 241, 0.3)'
        : '#c7d2fe';
    }};
`;

export const FilterSectionLabel = styled.span`
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: ${(props) => props.theme.colorText};
  opacity: 0.8;
  margin-bottom: 8px;
`;

export const FilterSelect = styled.select`
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  background: ${(props) =>
    props.theme.colorBgBase === '#09090b' ? '#09090b' : '#ffffff'};
  border: 1px solid
    ${(props) =>
      props.theme.colorBgBase === '#09090b'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.1)'};
  color: ${(props) => props.theme.colorTextBase};
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:focus {
    border-color: ${(props) => props.theme.colorPrimary};
    box-shadow: 0 0 0 2px ${(props) => props.theme.colorPrimary}22;
  }
`;

export const StyledInput = styled.input`
  width: 100%;
  background: ${(props) =>
    props.theme.colorBgBase === '#09090b' ? '#09090b' : '#ffffff'};
  border: 1px solid
    ${(props) =>
      props.theme.colorBgBase === '#09090b'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.1)'};
  border-radius: 10px;
  font-size: 13px;
  padding: 9px 12px;
  color: ${(props) => props.theme.colorTextBase};
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: ${(props) => props.theme.colorPrimary};
    box-shadow: 0 0 0 2px ${(props) => props.theme.colorPrimary}22;
  }
`;

export const EmptyStateCard = styled.div`
  border-radius: 16px;
  border: 1px dashed ${(props) => props.theme.colorBorderSecondary};
  background: transparent;
  text-align: center;
  padding: 48px 24px;
`;

export const ListFilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
  background: ${(props) => props.theme.colorBgContainer};
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid ${(props) => props.theme.colorBorderSecondary};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
`;

export const SearchInputWrapper = styled.div`
  flex: 1;
  min-width: 250px;
`;

export const SelectWrapper = styled.div`
  min-width: 160px;

  @media (max-width: 576px) {
    width: 100%;
  }
`;

export const SegmentedWrapper = styled.div`
  display: flex;
  background: ${(props) =>
    props.theme.colorBgBase === '#09090b'
      ? 'rgba(255,255,255,0.03)'
      : '#f1f5f9'};
  padding: 3px;
  border-radius: 8px;
  border: 1px solid ${(props) => props.theme.colorBorderSecondary};

  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

interface StatusFilterButtonProps {
  $active: boolean;
}

export const StatusFilterButton = styled.button<StatusFilterButtonProps>`
  background: ${(props) =>
    props.$active
      ? props.theme.colorBgBase === '#09090b'
        ? 'rgba(255,255,255,0.08)'
        : '#ffffff'
      : 'transparent'};
  border: none;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: ${(props) =>
    props.$active
      ? props.theme.colorPrimary
      : props.theme.colorBgBase === '#09090b'
        ? '#94a3b8'
        : '#64748b'};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${(props) =>
    props.$active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'};
  outline: none;

  &:hover {
    color: ${(props) => props.theme.colorPrimary};
    background: ${(props) =>
      props.$active
        ? props.theme.colorBgBase === '#09090b'
          ? 'rgba(255,255,255,0.08)'
          : '#ffffff'
        : props.theme.colorBgBase === '#09090b'
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(0,0,0,0.02)'};
  }

  @media (max-width: 768px) {
    flex: 1;
    text-align: center;
    padding: 6px 4px;
  }
`;

export const TableContainer = styled.div`
  width: 100%;
  overflow-y: auto;
  overflow-x: auto;
  flex: 1;
  background: ${(props) => props.theme.colorBgContainer};
  border: 1px solid ${(props) => props.theme.colorBorderSecondary};
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${(props) => props.theme.colorBorderSecondary};
    border-radius: 4px;
  }
`;

export const ClinicalTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;

  th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: ${(props) => props.theme.colorBgContainer} !important;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${(props) => props.theme.colorTextSecondary};
    padding: 14px 20px;
    border-bottom: 1px solid ${(props) => props.theme.colorBorderSecondary};
  }

  td {
    padding: 16px 20px;
    border-bottom: 1px solid ${(props) => props.theme.colorBorderSecondary};
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .snippet-code {
    font-size: 11px;
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 4px;
    background: ${(props) =>
      props.theme.colorBgBase === '#09090b'
        ? 'rgba(255, 255, 255, 0.08)'
        : '#f1f5f9'};
    color: ${(props) => props.theme.colorTextSecondary};
  }
`;

export const TableRow = styled.tr`
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);

  &:hover {
    background: ${(props) =>
      props.theme.colorBgBase === '#09090b'
        ? 'rgba(99, 102, 241, 0.05)'
        : 'rgba(99, 102, 241, 0.02)'};

    .doc-id-cell span {
      color: ${(props) => props.theme.colorPrimary} !important;
    }
  }
`;

export const LayoutRow = styled.div`
  flex: 1;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;

  @media (max-width: 768px) {
    overflow: visible;
    height: auto;
  }
`;
