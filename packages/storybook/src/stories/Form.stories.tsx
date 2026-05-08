import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Form } from '../Form';

const meta: Meta<typeof Form> = {
  title: 'Components/Form',
  component: Form,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Default: Story = {
  render: () => (
    <Form>
      <Form.Item label="Username">
        <Form.Input name="username" placeholder="Enter username" />
      </Form.Item>
      <Form.Item label="Email">
        <Form.Input name="email" type="email" placeholder="Enter email" />
      </Form.Item>
      <Form.Item label="Password">
        <Form.Input name="password" type="password" placeholder="Enter password" />
      </Form.Item>
      <Form.Item>
        <Form.Button type="submit">Submit</Form.Button>
      </Form.Item>
    </Form>
  ),
};

export const WithValidation: Story = {
  render: () => (
    <Form>
      <Form.Item label="Required Field" required>
        <Form.Input name="required" placeholder="Required field" />
      </Form.Item>
      <Form.Item label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
        <Form.Input name="email" type="email" placeholder="Enter email" />
      </Form.Item>
      <Form.Item label="Password" rules={[{ min: 8, message: 'Min 8 chars' }]}>
        <Form.Input name="password" type="password" placeholder="Enter password" />
      </Form.Item>
    </Form>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Form layout="horizontal">
      <Form.Item label="Username">
        <Form.Input name="username" placeholder="Enter username" />
      </Form.Item>
      <Form.Item label="Email">
        <Form.Input name="email" type="email" placeholder="Enter email" />
      </Form.Item>
    </Form>
  ),
};

export const Inline: Story = {
  render: () => (
    <Form layout="inline">
      <Form.Item label="Search">
        <Form.Input name="search" placeholder="Search..." />
      </Form.Item>
      <Form.Item>
        <Form.Button>Search</Form.Button>
      </Form.Item>
    </Form>
  ),
};

export const WithSelect: Story = {
  render: () => (
    <Form>
      <Form.Item label="Country">
        <Form.Select name="country" placeholder="Select country">
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="ca">Canada</option>
        </Form.Select>
      </Form.Item>
      <Form.Item label="Language">
        <Form.Select name="language" multiple>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
        </Form.Select>
      </Form.Item>
    </Form>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <Form>
      <Form.Item>
        <Form.Checkbox name="terms" value="agree">
          I agree to the terms and conditions
        </Form.Checkbox>
      </Form.Item>
      <Form.Item>
        <Form.Checkbox name="newsletter" value="subscribe">
          Subscribe to newsletter
        </Form.Checkbox>
      </Form.Item>
    </Form>
  ),
};

export const WithRadio: Story = {
  render: () => (
    <Form>
      <Form.Item label="Plan">
        <Form.Radio.Group name="plan">
          <Form.Radio value="free">Free</Form.Radio>
          <Form.Radio value="pro">Pro</Form.Radio>
          <Form.Radio value="enterprise">Enterprise</Form.Radio>
        </Form.Radio.Group>
      </Form.Item>
    </Form>
  ),
};

export const WithDatePicker: Story = {
  render: () => (
    <Form>
      <Form.Item label="Start Date">
        <Form.DatePicker name="startDate" />
      </Form.Item>
      <Form.Item label="End Date">
        <Form.DatePicker name="endDate" range />
      </Form.Item>
    </Form>
  ),
};

export const WithSwitch: Story = {
  render: () => (
    <Form>
      <Form.Item label="Enable Notifications">
        <Form.Switch name="notifications" />
      </Form.Item>
      <Form.Item label="Dark Mode">
        <Form.Switch name="darkMode" />
      </Form.Item>
    </Form>
  ),
};

export const WithUpload: Story = {
  render: () => (
    <Form>
      <Form.Item label="Upload File">
        <Form.Upload name="file" accept="image/*" />
      </Form.Item>
    </Form>
  ),
};

export const LoginForm: Story = {
  render: () => (
    <Form>
      <Form.Item label="Email">
        <Form.Input name="email" type="email" placeholder="Enter your email" prefix="@" />
      </Form.Item>
      <Form.Item label="Password">
        <Form.Input name="password" type="password" placeholder="Enter your password" />
      </Form.Item>
      <Form.Item>
        <Form.Checkbox name="remember">Remember me</Form.Checkbox>
      </Form.Item>
      <Form.Item>
        <Form.Button type="primary" block>Sign In</Form.Button>
      </Form.Item>
    </Form>
  ),
};

export const RegisterForm: Story = {
  render: () => (
    <Form>
      <Form.Item label="Username">
        <Form.Input name="username" placeholder="Choose a username" />
      </Form.Item>
      <Form.Item label="Email">
        <Form.Input name="email" type="email" placeholder="Enter your email" />
      </Form.Item>
      <Form.Item label="Password">
        <Form.Input name="password" type="password" placeholder="Create a password" />
      </Form.Item>
      <Form.Item label="Confirm Password">
        <Form.Input name="confirmPassword" type="password" placeholder="Confirm password" />
      </Form.Item>
      <Form.Item>
        <Form.Checkbox name="terms" required>I agree to the Terms of Service</Form.Checkbox>
      </Form.Item>
      <Form.Item>
        <Form.Button type="primary" block>Create Account</Form.Button>
      </Form.Item>
    </Form>
  ),
};

export const CheckoutForm: Story = {
  render: () => (
    <Form>
      <Form.Item label="Card Number">
        <Form.Input name="cardNumber" placeholder="1234 5678 9012 3456" />
      </Form.Item>
      <Form.Item label="Expiry Date">
        <Form.Input name="expiry" placeholder="MM/YY" />
      </Form.Item>
      <Form.Item label="CVV">
        <Form.Input name="cvv" placeholder="123" />
      </Form.Item>
      <Form.Item label="Name on Card">
        <Form.Input name="cardName" placeholder="John Doe" />
      </Form.Item>
      <Form.Item>
        <Form.Button type="primary" block>Pay Now</Form.Button>
      </Form.Item>
    </Form>
  ),
};