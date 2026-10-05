import type { Meta, StoryObj } from '@storybook/react-native';
import PriceRow from './PriceRow';
import { mockSwmPrice } from '../../../../.storybook/storyMocks';
import { mockTranslate } from '../../../../.storybook/storyDecorators';

const meta: Meta<typeof PriceRow> = {
  title: 'Header/PriceRow',
  component: PriceRow,
  args: {
    translate: mockTranslate,
    zecPrice: mockSwmPrice,
    shown: true,
  },
};

export default meta;
type Story = StoryObj<typeof PriceRow>;

export const Default: Story = {};
export const NoPrice: Story = {
  args: { zecPrice: { zecPrice: 0, date: 0 } },
};
export const Falling: Story = {
  args: { zecPrice: { ...mockSwmPrice, changePct24h: -3.2 } },
};
export const AsOf: Story = {
  args: { zecPrice: { ...mockSwmPrice, date: Date.now() - 12 * 60_000 } },
};
export const Stale: Story = {
  args: { zecPrice: { ...mockSwmPrice, relayStale: true } },
};
