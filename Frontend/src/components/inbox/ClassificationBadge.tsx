import React from 'react';
import { Badge } from '../common/Badge';
import type { Classification } from '../../types/message';

interface ClassificationBadgeProps {
  classification: Classification;
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  classification,
}) => {
  const config = {
    lead: { variant: 'info' as const, label: 'Lead' },
    offering: { variant: 'success' as const, label: 'Offering' },
    ignored: { variant: 'neutral' as const, label: 'Ignored' },
    unknown: { variant: 'warning' as const, label: 'Unknown' },
    noise: { variant: 'neutral' as const, label: 'Noise' },
  };

  const { variant = 'neutral', label = 'Unknown' } = config[classification] || {};

  return <Badge variant={variant}>{label}</Badge>;
};
