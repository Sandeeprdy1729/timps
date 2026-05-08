/**
 * TIMPS Desktop - DatePicker
 * Date and time picker components.
 */

import { useState } from 'react';
import './DatePicker.css';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({ value, onChange, minDate, maxDate }: DatePickerProps) {
  const [viewDate, setViewDate] = useState(value || new Date());

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(newDate);
  };

  return (
    <div className="date-picker">
      <div className="date-picker-header">
        <button onClick={handlePrevMonth}>←</button>
        <span>{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
        <button onClick={handleNextMonth}>→</button>
      </div>
      <div className="date-picker-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="date-picker-days">
        {days.map((day, index) => (
          day ? (
            <button 
              key={index} 
              className={`day ${value?.getDate() === day ? 'selected' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day}
            </button>
          ) : (
            <span key={index} />
          )
        ))}
      </div>
    </div>
  );
}

interface TimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const hours = value?.getHours() || 0;
  const minutes = value?.getMinutes() || 0;

  const handleHoursChange = (h: number) => {
    const newDate = new Date(value || new Date());
    newDate.setHours(h);
    onChange(newDate);
  };

  const handleMinutesChange = (m: number) => {
    const newDate = new Date(value || new Date());
    newDate.setMinutes(m);
    onChange(newDate);
  };

  return (
    <div className="time-picker">
      <select value={hours} onChange={e => handleHoursChange(Number(e.target.value))}>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
        ))}
      </select>
      <span>:</span>
      <select value={minutes} onChange={e => handleMinutesChange(Number(e.target.value))}>
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
}

interface DateRangePickerProps {
  startDate?: Date;
  endDate?: Date;
  onChange: (start: Date, end: Date) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  return (
    <div className="date-range-picker">
      <DatePicker value={startDate} onChange={(date) => onChange(date, endDate || date)} />
      <span>to</span>
      <DatePicker value={endDate} onChange={(date) => onChange(startDate || date, date)} />
    </div>
  );
}