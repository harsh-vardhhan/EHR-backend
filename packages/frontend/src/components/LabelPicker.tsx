import type { Label } from '../types/annotation';
import { Plus } from 'lucide-react';
import styled, { keyframes } from 'styled-components';
import { MEDICAL_LABELS, LABEL_IDS } from '../constants/labels';

interface Props {
  position: { x: number; y: number };
  onSelect: (label: Label) => void;
  onClose: () => void;
}

export function LabelPicker({ position, onSelect, onClose }: Props) {
  // Ensure the 200px wide popup doesn't overflow mobile viewport boundaries.
  // We constrain x to be at least 110px from the left and right edges.
  const safePosition = {
    x: Math.max(110, Math.min(position.x, window.innerWidth - 110)),
    y: Math.max(10, position.y),
  };

  return (
    <>
      <Overlay onMouseDown={onClose} />
      <StyledCard
        position={safePosition}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <HeaderContainer>
          <StyledHeaderText>
            <StyledPlusIcon />
            ASSIGN CLINICAL LABEL
          </StyledHeaderText>
        </HeaderContainer>
        <div className="flex flex-col gap-1 w-full">
          {LABEL_IDS.map((id) => {
            const { icon, color } = MEDICAL_LABELS[id];
            return (
              <LabelButton
                key={id}
                $hoverColor={color}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(id);
                }}
              >
                <IconWrapper color={color}>{icon}</IconWrapper>
                <LabelText>{id}</LabelText>
              </LabelButton>
            );
          })}
        </div>
      </StyledCard>
    </>
  );
}

// --- Styled Components ---

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
`;

const popIn = keyframes`
  0% { transform: translate(-50%, -95%) scale(0.97); opacity: 0; }
  100% { transform: translate(-50%, -100%) translateY(-6px) scale(1); opacity: 1; }
`;

const StyledCard = styled.div<{ position: { x: number; y: number } }>`
  position: fixed;
  z-index: 1001;
  left: ${props => props.position.x}px;
  top: ${props => props.position.y}px;
  width: 210px;
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} !important;
  background: ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px ${props => props.theme.colorBgBase === '#09090b' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.12)'} !important;
  animation: ${popIn} 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  padding: 12px 8px;
`;

const HeaderContainer = styled.div`
  padding: 0 12px 10px 12px;
  border-bottom: 1px solid ${props => props.theme.colorBorderSecondary};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
`;

const StyledHeaderText = styled.span`
  font-size: 11px;
  color: ${props => props.theme.colorTextSecondary};
  letter-spacing: 0.05em;
  font-weight: 600;
  display: flex;
  align-items: center;
`;

const LabelButton = styled.button<{ $hoverColor?: string }>`
  text-align: left;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  
  &:hover {
    background: ${props => props.$hoverColor}15 !important;
    transform: translateX(4px);
    span {
      color: ${props => props.$hoverColor} !important;
    }
  }
`;

const IconWrapper = styled.span<{ color: string }>`
  color: ${props => props.color};
  margin-right: 12px;
  font-size: 20px;
  display: flex;
  align-items: center;
  padding-top: 2px;
`;

const LabelText = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colorTextBase};
`;

const StyledPlusIcon = styled(Plus)`
  margin-right: 6px;
  width: 12px;
  height: 12px;
`;
