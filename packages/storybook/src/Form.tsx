import React from 'react';

interface FormProps {
  children?: React.ReactNode;
  layout?: 'vertical' | 'horizontal' | 'inline';
}
interface FormItemProps {
  label?: string;
  required?: boolean;
  rules?: any[];
  children?: React.ReactNode;
}
interface FormInputProps {
  name?: string;
  type?: string;
  placeholder?: string;
  prefix?: string;
  rows?: number;
  accept?: string;
}
interface FormButtonProps {
  type?: 'primary';
  block?: boolean;
  children?: React.ReactNode;
}
interface FormCheckboxProps {
  name?: string;
  value?: string;
  required?: boolean;
  children?: React.ReactNode;
}
interface FormRadioProps {
  value?: string;
  children?: React.ReactNode;
}
interface FormDatePickerProps {
  name?: string;
  range?: boolean;
}
interface FormSwitchProps { name?: string; }
interface FormUploadProps {
  name?: string;
  accept?: string;
}
interface FormSelectProps {
  name?: string;
  placeholder?: string;
  multiple?: boolean;
  children?: React.ReactNode;
}

const Item: React.FC<FormItemProps> = ({ label, required, children }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 500 }}>{label}{required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}</div>}
    {children}
  </div>
);

const FormInput: React.FC<FormInputProps> = ({ name, type, placeholder, prefix, rows, accept }) => {
  const style: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  return rows ? (
    <textarea name={name} placeholder={placeholder} rows={rows} style={{ ...style, resize: 'vertical' }} />
  ) : (
    <input name={name} type={type ?? 'text'} placeholder={placeholder} accept={accept} style={style} />
  );
};

const FormButton: React.FC<FormButtonProps> = ({ type, block, children }) => (
  <button style={{ background: type === 'primary' ? '#4f46e5' : '#e5e7eb', color: type === 'primary' ? '#fff' : '#111827', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, cursor: 'pointer', width: block ? '100%' : undefined }}>
    {children}
  </button>
);

const FormCheckbox: React.FC<FormCheckboxProps> = ({ children }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
    <input type="checkbox" style={{ width: 16, height: 16 }} />
    {children}
  </label>
);

const RadioGroup: React.FC<{ name?: string; children?: React.ReactNode }> = ({ name, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
);

const FormRadio: React.FC<FormRadioProps> & { Group: typeof RadioGroup } = ({ value, children }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
    <input type="radio" name="radioGroup" value={value} style={{ width: 16, height: 16 }} />
    {children}
  </label>
);
FormRadio.Group = RadioGroup;

const FormDatePicker: React.FC<FormDatePickerProps> = ({ name }) => (
  <input name={name} type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
);

const FormSwitch: React.FC<FormSwitchProps> = () => (
  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
    <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} />
    <span style={{ position: 'absolute', inset: 0, background: '#d1d5db', borderRadius: 12, transition: '0.3s' }} />
  </label>
);

const FormUpload: React.FC<FormUploadProps> = () => (
  <div style={{ border: '2px dashed #d1d5db', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>
    Click or drag file to upload
  </div>
);

const FormSelect: React.FC<FormSelectProps> = ({ placeholder, children }) => (
  <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
    {placeholder && <option value="">{placeholder}</option>}
    {children}
  </select>
);

export const Form: React.FC<FormProps> & {
  Item: typeof Item;
  Input: typeof FormInput;
  Button: typeof FormButton;
  Checkbox: typeof FormCheckbox;
  Select: typeof FormSelect;
  Radio: typeof FormRadio & { Group: typeof RadioGroup };
  DatePicker: typeof FormDatePicker;
  Switch: typeof FormSwitch;
  Upload: typeof FormUpload;
} = ({ children, layout = 'vertical' }) => {
  const flexDir = layout === 'inline' ? 'row' : layout === 'horizontal' ? 'row' : 'column';
  return (
    <form style={{ display: 'flex', flexDirection: flexDir, gap: layout === 'inline' ? 12 : 0, flexWrap: 'wrap', alignItems: layout === 'inline' ? 'flex-end' : undefined }}>
      {children}
    </form>
  );
};
Form.Item = Item;
Form.Input = FormInput;
Form.Button = FormButton;
Form.Checkbox = FormCheckbox;
Form.Select = FormSelect;
Form.Radio = Object.assign(FormRadio, { Group: RadioGroup });
Form.DatePicker = FormDatePicker;
Form.Switch = FormSwitch;
Form.Upload = FormUpload;
