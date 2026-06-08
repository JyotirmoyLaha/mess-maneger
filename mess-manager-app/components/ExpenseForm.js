import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Shadows } from './Theme';
import { PlusCircle, Edit2, ShoppingBag, ArrowRight } from 'lucide-react-native';

export default function ExpenseForm({
  editId = null,
  expenses = [],
  onSubmitExpense,
  onCancelEdit
}) {
  const [itemName, setItemName] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      const expense = expenses.find((x) => x.id === editId);
      if (expense) {
        setItemName(expense.item);
        setItemCost(String(expense.cost));
      }
    } else {
      setItemName('');
      setItemCost('');
    }
  }, [editId, expenses]);

  const handleSubmit = async () => {
    if (!itemName.trim()) return;
    const cost = parseFloat(itemCost);
    if (isNaN(cost) || cost <= 0) return;

    setSaving(true);
    try {
      await onSubmitExpense(itemName.trim(), cost, editId);
      setItemName('');
      setItemCost('');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!editId;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View style={[
            styles.iconBg, 
            { backgroundColor: isEditing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.15)' }
          ]}>
            {isEditing ? (
              <Edit2 size={16} color={Colors.emerald} />
            ) : (
              <PlusCircle size={16} color={Colors.emerald} />
            )}
          </View>
          <Text style={[styles.headerTitle, { color: isEditing ? Colors.emerald : Colors.textPrimary }]}>
            {isEditing ? 'Edit Item' : 'Add Expense'}
          </Text>
        </View>

        {isEditing ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancelEdit}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.formRow}>
        {/* Item Name */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputIcon}>
            <ShoppingBag size={16} color={Colors.textMuted} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="What did you buy?"
            placeholderTextColor={Colors.textMuted}
            value={itemName}
            onChangeText={setItemName}
            editable={!saving}
          />
        </View>

        {/* Cost */}
        <View style={[styles.inputWrapper, styles.costWrapper]}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={[styles.input, styles.costInput]}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            value={itemCost}
            onChangeText={setItemCost}
            editable={!saving}
          />
        </View>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          { backgroundColor: Colors.emerald }
        ]}
        onPress={handleSubmit}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <View style={styles.submitBtnContent}>
            <Text style={styles.submitBtnText}>
              {isEditing ? 'Update Entry' : 'Add Item'}
            </Text>
            <ArrowRight size={16} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    marginBottom: 20,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBg: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: Colors.redLight,
  },
  cancelBtnText: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
  },
  costWrapper: {
    flex: 0.45,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencySymbol: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '500',
  },
  costInput: {
    fontWeight: '700',
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
