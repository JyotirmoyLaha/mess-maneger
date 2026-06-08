import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from './Theme';
import { PiggyBank, CalendarCheck } from 'lucide-react-native';

export default function RemainingHistory({ history = [], carryForwardBalance = 0 }) {
  if (history.length === 0) return null;

  const monthColors = [
    { bg: Colors.emerald, text: '#e6fffa', lightBg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' },
    { bg: '#059669', text: '#e6fffa', lightBg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.25)' },
    { bg: '#0d9488', text: '#e6fffa', lightBg: 'rgba(13, 148, 136, 0.12)', border: 'rgba(13, 148, 136, 0.25)' },
    { bg: '#10b981', text: '#e6fffa', lightBg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' },
  ];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBg}>
            <PiggyBank size={18} color={Colors.emerald} />
          </View>
          <Text style={styles.headerTitle}>Previous Months Remaining</Text>
        </View>
        <Text style={styles.totalBadge}>
          ₹{carryForwardBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* History List */}
      <View style={styles.list}>
        {history.map((entry, idx) => {
          const [year, month] = entry.month.split('-');
          const monthDate = new Date(Number(year), Number(month) - 1, 1);
          const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const color = monthColors[idx % monthColors.length];
          const isPositive = (entry.remaining || 0) >= 0;

          return (
            <View key={entry.month} style={styles.item}>
              <View style={styles.itemLeft}>
                <View style={[styles.itemIconBg, { backgroundColor: color.lightBg, borderColor: color.border }]}>
                  <CalendarCheck size={16} color={color.bg} />
                </View>
                <View>
                  <Text style={styles.itemMonth}>{monthLabel}</Text>
                  <Text style={styles.itemDetails}>
                    Fund: ₹{(entry.totalFund || 0).toLocaleString('en-IN')} · Spent: ₹{(entry.totalSpent || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.badge, 
                { 
                  backgroundColor: isPositive ? color.lightBg : Colors.redLight,
                  borderColor: isPositive ? color.border : Colors.redBorder
                }
              ]}>
                <Text style={[styles.badgeText, { color: isPositive ? color.bg : Colors.red }]}>
                  {isPositive ? '+' : ''}₹{(entry.remaining || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Grand Total Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.footerIconBg}>
            <Text style={styles.sigma}>Σ</Text>
          </View>
          <Text style={styles.footerTitle}>Total Carry Forward</Text>
        </View>
        <Text style={[styles.footerValue, { color: carryForwardBalance >= 0 ? Colors.emerald : Colors.red }]}>
          ₹{carryForwardBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  totalBadge: {
    color: Colors.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '800',
    overflow: 'hidden',
  },
  list: {
    paddingVertical: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconBg: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 12,
  },
  itemMonth: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDetails: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sigma: {
    color: Colors.emerald,
    fontWeight: '900',
    fontSize: 13,
  },
  footerTitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  footerValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});
