'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  type NumericFieldValue,
  toNumericField,
  parseWholeField,
  parseDecimalField,
} from '@/lib/numeric-field';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: NumericFieldValue;
  onValueChange: (value: NumericFieldValue) => void;
  mode?: 'whole' | 'decimal';
}

export function NumericInput({
  value,
  onValueChange,
  mode = 'decimal',
  className,
  ...props
}: NumericInputProps) {
  return (
    <Input
      {...props}
      type="number"
      value={toNumericField(value)}
      onChange={(e) => {
        const parsed = mode === 'whole'
          ? parseWholeField(e.target.value)
          : parseDecimalField(e.target.value);
        onValueChange(parsed);
      }}
      className={cn(className)}
    />
  );
}
