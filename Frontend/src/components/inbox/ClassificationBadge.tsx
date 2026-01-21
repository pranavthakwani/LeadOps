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
  };

  const { variant, label } = config[classification];

  return <Badge variant={variant}>{label}</Badge>;
};
